import "server-only";

import { z } from "zod";

import { LOCALES } from "@/lib/public-site";
import { db } from "@/server/db";
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
    const [person] = await tx<{ id: string }[]>`
      SELECT id FROM users WHERE lower(email) = ${input.email} LIMIT 1
    `;
    const [inquiry] = await tx<{ id: string }[]>`
      INSERT INTO inquiries (
        salutation, first_name, last_name, email, phone, language, course_form,
        self_assessment, goal, message, participant_id
      ) VALUES (
        ${input.salutation ?? null}, ${input.firstName}, ${input.lastName}, ${input.email},
        ${input.phone ?? null}, ${input.language ?? null}, ${input.courseForm ?? null},
        ${input.selfAssessment ?? null}, ${input.goal ?? null},
        ${[input.courseCode, input.message].filter(Boolean).join(" · ") || null}, ${person?.id ?? null}
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

export async function listInquiries() {
  return db()<{
    id: string; first_name: string; last_name: string; email: string; phone: string | null;
    language: string | null; course_form: string | null; message: string | null; handled: boolean; created_at: Date;
  }[]>`
    SELECT id, first_name, last_name, email, phone, language, course_form, message, handled, created_at
    FROM inquiries ORDER BY created_at DESC LIMIT 200
  `;
}
