import "server-only";

import { z } from "zod";

import { CONSENT_COPY, LOCALES } from "@/lib/public-site";
import type { PublicInquiry } from "@/lib/public-site";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import { recordPublicSubmission } from "@/server/services/public-submissions";
import { notifyRoles } from "@/server/services/notifications";

export const inquirySchema = z.object({
  locale: z.enum(LOCALES),
  salutation: z.enum(["herr", "frau", "divers"]).nullable().optional(),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().max(60).optional(),
  language: z.string().trim().max(80).optional(),
  courseForm: z.string().trim().max(80).optional(),
  courseCode: z.string().trim().max(80).optional(),
  selfAssessment: z.string().trim().max(80).optional(),
  goal: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true),
  website: z.string().max(0).optional(), // hidden honeypot
});

export async function submitInquiry(input: z.infer<typeof inquirySchema>, ip: string | null) {
  return db().begin(async (tx) => {
    await recordPublicSubmission(tx, "inquiry", input.email, ip);
    const [inquiry] = await tx<{ id: string }[]>`
      INSERT INTO inquiries (
        salutation, first_name, last_name, email, phone, language, course_form,
        self_assessment, goal, message, consent_at, consent_text
      ) VALUES (
        ${input.salutation ?? null}, ${input.firstName}, ${input.lastName}, ${input.email},
        ${input.phone ?? null}, ${input.language ?? null}, ${input.courseForm ?? null},
        ${input.selfAssessment ?? null}, ${input.goal ?? null},
        ${[input.courseCode, input.message].filter(Boolean).join(" · ") || null},
        now(), ${CONSENT_COPY[input.locale]}
      ) RETURNING id
    `;
    const [task] = await tx<{ id: string }[]>`
      INSERT INTO tasks (title, description, priority)
      VALUES (
        ${`Website-Anfrage: ${input.firstName} ${input.lastName}`},
        ${`Kontakt: ${input.email}${input.phone ? ` · ${input.phone}` : ""}${input.courseCode ? ` · Kurs: ${input.courseCode}` : ""}`},
        'normal'
      ) RETURNING id
    `;
    await tx`INSERT INTO task_links (task_id, entity_type, entity_id) VALUES (${task.id}, 'inquiry', ${inquiry.id})`;
    await notifyRoles(tx, ["office", "admin"], {
      kind: "website_inquiry", title: "Neue Website-Anfrage", body: `${input.firstName} ${input.lastName}`,
      entityType: "inquiry", entityId: inquiry.id,
    });
    return { id: inquiry.id };
  });
}

export async function listInquiries(): Promise<PublicInquiry[]> {
  const rows = await db()<{
    id: string; first_name: string; last_name: string; email: string; phone: string | null;
    language: string | null; course_form: string | null; message: string | null; handled: boolean;
    participant_id: string | null; created_at: Date;
  }[]>`
    SELECT id, first_name, last_name, email, phone, language, course_form, message, handled, participant_id, created_at
    FROM inquiries ORDER BY created_at DESC LIMIT 200
  `;
  return rows.map((row) => ({ id: row.id, firstName: row.first_name, lastName: row.last_name,
    email: row.email, phone: row.phone, language: row.language, courseForm: row.course_form,
    message: row.message, handled: row.handled, participantId: row.participant_id, createdAt: row.created_at.toISOString() }));
}

export const inquiryUpdateSchema = z.object({
  handled: z.boolean().optional(),
  participantId: z.uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function updateInquiry(id: string, patch: z.infer<typeof inquiryUpdateSchema>, actorId: string) {
  return db().begin(async (tx) => {
    const [before] = await tx<{ id: string; participant_id: string | null; handled: boolean }[]>`
      SELECT id, participant_id, handled FROM inquiries WHERE id = ${id} FOR UPDATE
    `;
    if (!before) throw notFound("Anfrage wurde nicht gefunden.");
    if (patch.participantId) {
      const [person] = await tx<{ id: string }[]>`
        SELECT users.id FROM users JOIN user_roles ON user_roles.user_id = users.id
        WHERE users.id = ${patch.participantId} AND user_roles.role = 'participant'
      `;
      if (!person) throw notFound("Teilnehmende Person wurde nicht gefunden.");
    }
    const [row] = await tx<{ id: string; participant_id: string | null; handled: boolean }[]>`
      UPDATE inquiries SET participant_id = ${patch.participantId !== undefined ? patch.participantId : before.participant_id},
        handled = ${patch.handled ?? before.handled} WHERE id = ${id}
      RETURNING id, participant_id, handled
    `;
    await recordChange(tx, { entityType: "inquiry", entityId: id, eventType: "updated", summary: "Website-Anfrage zugeordnet/bearbeitet", before, after: row, actorId });
    return { id: row.id, participantId: row.participant_id, handled: row.handled };
  });
}
