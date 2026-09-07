import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";
import { hashPassword } from "@/lib/passwords";

const salutationSchema = z.enum(["frau", "herr", "divers", "keine_angabe"]);
const genderSchema = z.enum(["weiblich", "männlich", "divers", "keine_angabe"]);
const notesSchema = z.union([z.string().trim().max(5000), z.array(z.string().trim().min(1).max(5000)).max(50)]).nullable().optional();
const profileFields = z.object({
  salutation: salutationSchema.nullable().optional(), firstName: z.string().trim().min(1).max(80).optional(), lastName: z.string().trim().min(1).max(100).optional(), gender: genderSchema.nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(),
  preferredContact: z.enum(["email", "phone", "postal"]).optional(),
  notes: notesSchema, emailReminders: z.boolean().optional(), languagePreference: z.string().trim().max(60).nullable().optional(),
});
const createSchema = profileFields.extend({ name: z.string().trim().min(2).max(120).optional(), email: z.email(), password: z.string().min(12).max(256) }).superRefine((value, context) => {
  if ((!value.firstName || !value.lastName) && !value.name) context.addIssue({ code: "custom", path: ["firstName"], message: "Vorname und Nachname sind erforderlich." });
});

function displayName(input: { firstName?: string; lastName?: string; name?: string }, fallback = "Teilnehmer") {
  const structured = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return structured || input.name?.trim() || fallback;
}

function noteEntries(value: string | string[] | null | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : []).map((note) => note.trim()).filter(Boolean);
}

export async function GET() {
  try {
    await requireRole("office");
    const participants = await db()`
      SELECT u.id, u.name, u.email, u.created_at, p.salutation, p.first_name, p.last_name, p.gender, p.phone, p.street, p.postal_code, p.city,
             p.preferred_contact, p.notes, p.email_reminders, p.language_preference,
             COALESCE(json_agg(json_build_object('id', e.id, 'courseId', e.course_id, 'courseCode', c.code, 'courseLanguage', c.language, 'courseLevel', c.level, 'courseStatus', c.status, 'course', CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacherId', c.teacher_id, 'standardRoomId', c.standard_room_id) END, 'billingType', e.billing_type, 'creditLessons', e.credit_lessons, 'paymentStatus', e.payment_status, 'active', e.active) ORDER BY e.active DESC, c.code) FILTER (WHERE e.id IS NOT NULL), '[]') AS enrollments
             , (SELECT COALESCE(json_agg(json_build_object('eventType', h.event_type, 'summary', h.summary, 'occurredAt', h.occurred_at) ORDER BY h.occurred_at DESC), '[]') FROM change_history h WHERE (h.entity_type = 'participant' AND h.entity_id = u.id) OR (h.entity_type = 'enrollment' AND h.entity_id IN (SELECT enrollment_history.id FROM enrollments enrollment_history WHERE enrollment_history.participant_id = u.id))) AS history,
             (SELECT COALESCE(json_agg(json_build_object('id', n.id, 'body', n.body, 'createdAt', n.created_at, 'createdBy', creator.name) ORDER BY n.created_at DESC), '[]') FROM person_notes n LEFT JOIN users creator ON creator.id = n.created_by WHERE n.user_id = u.id) AS notes_history
      FROM users u LEFT JOIN participant_profiles p ON p.user_id = u.id
      LEFT JOIN enrollments e ON e.participant_id = u.id LEFT JOIN courses c ON c.id = e.course_id
      WHERE u.role = 'participant' GROUP BY u.id, p.user_id ORDER BY u.name
    `;
    return NextResponse.json({ participants });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Teilnehmer konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("office");
    const input = createSchema.parse(await request.json());
    const sql = db();
    const participant = await sql.begin(async (transaction) => {
      const fullName = displayName(input);
      const notes = noteEntries(input.notes);
      const [user] = await transaction`INSERT INTO users (id, name, email, role, password_hash) VALUES (${randomUUID()}, ${fullName}, ${input.email.toLowerCase()}, 'participant', ${hashPassword(input.password)}) RETURNING id, name, email, role`;
      await transaction`INSERT INTO participant_profiles (user_id, salutation, first_name, last_name, gender, phone, street, postal_code, city, preferred_contact, notes, email_reminders, language_preference) VALUES (${user.id}, ${input.salutation ?? null}, ${input.firstName ?? null}, ${input.lastName ?? null}, ${input.gender ?? null}, ${input.phone ?? null}, ${input.street ?? null}, ${input.postalCode ?? null}, ${input.city ?? null}, ${input.preferredContact ?? "email"}, ${notes.at(-1) ?? null}, ${input.emailReminders ?? false}, ${input.languagePreference ?? null})`;
      for (const note of notes) {
        await transaction`INSERT INTO person_notes (id, user_id, body, created_by) VALUES (${randomUUID()}, ${user.id}, ${note}, ${actor.id})`;
      }
      const safeInput = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "password"));
      await transaction`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, after_data, actor_id) VALUES (${randomUUID()}, 'participant', ${user.id}, 'created', 'Teilnehmer angelegt', ${JSON.stringify(safeInput)}, ${actor.id})`;
      return user;
    });
    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Teilnehmerdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Diese E-Mail-Adresse wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Teilnehmer konnte nicht angelegt werden." }, { status: 500 });
  }
}
