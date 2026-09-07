import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";
import { hashPassword } from "@/lib/passwords";

const profileFields = z.object({
  phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(),
  dateOfBirth: z.string().date().nullable().optional(), preferredContact: z.enum(["email", "phone", "postal"]).optional(),
  emergencyName: z.string().trim().max(120).nullable().optional(), emergencyPhone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(), emailReminders: z.boolean().optional(), languagePreference: z.string().trim().max(60).nullable().optional(),
});
const createSchema = profileFields.extend({ name: z.string().trim().min(2).max(120), email: z.email(), password: z.string().min(12).max(256) });

export async function GET() {
  try {
    await requireRole("office");
    const participants = await db()`
      SELECT u.id, u.name, u.email, u.created_at, p.phone, p.street, p.postal_code, p.city, p.date_of_birth,
             p.preferred_contact, p.emergency_name, p.emergency_phone, p.notes, p.email_reminders, p.language_preference,
             COALESCE(json_agg(json_build_object('id', e.id, 'courseId', e.course_id, 'courseCode', c.code, 'billingType', e.billing_type, 'creditLessons', e.credit_lessons, 'paymentStatus', e.payment_status)) FILTER (WHERE e.id IS NOT NULL), '[]') AS enrollments
             , (SELECT COALESCE(json_agg(json_build_object('eventType', h.event_type, 'summary', h.summary, 'occurredAt', h.occurred_at) ORDER BY h.occurred_at DESC), '[]') FROM change_history h WHERE h.entity_type = 'participant' AND h.entity_id = u.id) AS history
      FROM users u LEFT JOIN participant_profiles p ON p.user_id = u.id
      LEFT JOIN enrollments e ON e.participant_id = u.id AND e.active = true LEFT JOIN courses c ON c.id = e.course_id
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
      const [user] = await transaction`INSERT INTO users (id, name, email, role, password_hash) VALUES (${randomUUID()}, ${input.name}, ${input.email.toLowerCase()}, 'participant', ${hashPassword(input.password)}) RETURNING id, name, email, role`;
      await transaction`INSERT INTO participant_profiles (user_id, phone, street, postal_code, city, date_of_birth, preferred_contact, emergency_name, emergency_phone, notes, email_reminders, language_preference) VALUES (${user.id}, ${input.phone ?? null}, ${input.street ?? null}, ${input.postalCode ?? null}, ${input.city ?? null}, ${input.dateOfBirth ?? null}, ${input.preferredContact ?? "email"}, ${input.emergencyName ?? null}, ${input.emergencyPhone ?? null}, ${input.notes ?? null}, ${input.emailReminders ?? false}, ${input.languagePreference ?? null})`;
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
