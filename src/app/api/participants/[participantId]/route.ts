import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const salutationSchema = z.enum(["frau", "herr", "divers", "keine_angabe"]);
const genderSchema = z.enum(["weiblich", "männlich", "divers", "keine_angabe"]);
const notesSchema = z.union([z.string().trim().max(5000), z.array(z.string().trim().min(1).max(5000)).max(50)]).nullable().optional();
function displayName(input: { firstName?: string | null; lastName?: string | null; name?: string | null }, fallback = "Teilnehmer") {
  const structured = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return structured || input.name?.trim() || fallback;
}
function noteEntries(value: string | string[] | null | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : []).map((note) => note.trim()).filter(Boolean);
}

/** Return a participant aggregate with course, attendance, billing and note references. */
export async function GET(_request: Request, context: { params: Promise<{ participantId: string }> }) {
  try {
    const user = await requireRole("office", "participant");
    const { participantId } = await context.params;
    const sql = db();
    const [participant] = user.role === "office"
      ? await sql`SELECT u.id, u.name, u.email, u.role, u.created_at, p.salutation, p.first_name, p.last_name, p.gender, p.phone, p.street, p.postal_code, p.city, p.preferred_contact, p.notes, p.email_reminders, p.language_preference FROM users u LEFT JOIN participant_profiles p ON p.user_id = u.id WHERE u.id = ${participantId} AND u.role = 'participant'`
      : await sql`SELECT u.id, u.name, u.email, u.role, u.created_at, p.salutation, p.first_name, p.last_name, p.gender, p.phone, p.street, p.postal_code, p.city, p.preferred_contact, p.notes, p.email_reminders, p.language_preference FROM users u LEFT JOIN participant_profiles p ON p.user_id = u.id WHERE u.id = ${participantId} AND u.role = 'participant' AND u.id = ${user.id}`;
    if (!participant) return NextResponse.json({ error: "Teilnehmer wurde nicht gefunden." }, { status: 404 });
    const [enrollments, history, notes] = await Promise.all([
      sql`SELECT e.*, json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacher', json_build_object('id', t.id, 'name', t.name, 'email', t.email), 'standardRoom', CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object('id', r.id, 'name', r.name, 'capacity', r.capacity, 'location', json_build_object('id', loc.id, 'name', loc.name, 'address', loc.address)) END, 'schedules', COALESCE((SELECT json_agg(json_build_object('id', cs.id, 'weekday', cs.weekday, 'startTime', cs.start_time, 'durationMinutes', cs.duration_minutes) ORDER BY cs.weekday, cs.start_time) FROM course_schedules cs WHERE cs.course_id = c.id), '[]')) AS course, COALESCE((SELECT json_agg(json_build_object('id', l.id, 'lessonId', l.id, 'startsAt', l.starts_at, 'status', l.status, 'roomId', l.room_id, 'attendanceStatus', a.status, 'confirmedAt', a.confirmed_at) ORDER BY l.starts_at) FROM lessons l LEFT JOIN attendance a ON a.lesson_id = l.id AND a.enrollment_id = e.id WHERE l.course_id = e.course_id), '[]') AS lesson_history, COALESCE((SELECT json_build_object('present', count(*) FILTER (WHERE a.status = 'present')::int, 'excused', count(*) FILTER (WHERE a.status = 'excused')::int, 'unexcused', count(*) FILTER (WHERE a.status = 'unexcused')::int, 'online', count(*) FILTER (WHERE a.status = 'online')::int, 'trial', count(*) FILTER (WHERE a.status = 'trial')::int) FROM attendance a WHERE a.enrollment_id = e.id), json_build_object('present', 0, 'excused', 0, 'unexcused', 0, 'online', 0, 'trial', 0)) AS attendance_summary, COALESCE((SELECT json_agg(json_build_object('id', pause.id, 'startsOn', pause.starts_on, 'endsOn', pause.ends_on, 'reason', pause.reason) ORDER BY pause.starts_on DESC) FROM enrollment_pauses pause WHERE pause.enrollment_id = e.id), '[]') AS pauses FROM enrollments e JOIN courses c ON c.id = e.course_id JOIN users t ON t.id = c.teacher_id LEFT JOIN rooms r ON r.id = c.standard_room_id LEFT JOIN locations loc ON loc.id = r.location_id WHERE e.participant_id = ${participantId} ORDER BY e.active DESC, c.code`,
      sql`SELECT h.id, h.entity_type, h.entity_id, h.event_type, h.summary, h.before_data, h.after_data, h.actor_id, h.occurred_at, actor.name AS actor_name FROM change_history h WHERE (h.entity_type = 'participant' AND h.entity_id = ${participantId}) OR (h.entity_type = 'enrollment' AND h.entity_id IN (SELECT e.id FROM enrollments e WHERE e.participant_id = ${participantId})) ORDER BY h.occurred_at DESC`,
      sql`SELECT n.id, n.user_id, n.body, n.created_by, n.created_at, creator.name AS created_by_name FROM person_notes n LEFT JOIN users creator ON creator.id = n.created_by WHERE n.user_id = ${participantId} ORDER BY n.created_at DESC`,
    ]);
    return NextResponse.json({ participant: { ...participant, enrollments, history, notes, notes_history: notes } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Teilnehmer konnte nicht geladen werden." }, { status: 500 });
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(), email: z.email().optional(), salutation: salutationSchema.nullable().optional(), firstName: z.string().trim().min(1).max(80).optional(), lastName: z.string().trim().min(1).max(100).optional(), gender: genderSchema.nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(), postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), preferredContact: z.enum(["email", "phone", "postal"]).optional(), notes: notesSchema, emailReminders: z.boolean().optional(), languagePreference: z.string().trim().max(60).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, context: { params: Promise<{ participantId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { participantId } = await context.params;
    const input = updateSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT u.id, u.name, u.email, p.* FROM users u LEFT JOIN participant_profiles p ON p.user_id = u.id WHERE u.id = ${participantId} AND u.role = 'participant'`;
    if (!existing) return NextResponse.json({ error: "Teilnehmer wurde nicht gefunden." }, { status: 404 });
    const updated = await sql.begin(async (transaction) => {
      const has = (key: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, key);
      const nextName = has("firstName") || has("lastName") ? displayName({ firstName: input.firstName ?? existing.first_name, lastName: input.lastName ?? existing.last_name }, existing.name) : input.name;
      const [user] = await transaction`UPDATE users SET name = COALESCE(${nextName ?? null}, name), email = COALESCE(${input.email?.toLowerCase() ?? null}, email) WHERE id = ${participantId} RETURNING id, name, email, role`;
      const [profile] = await transaction`INSERT INTO participant_profiles (user_id, salutation, first_name, last_name, gender) VALUES (${participantId}, ${input.salutation ?? null}, ${input.firstName ?? null}, ${input.lastName ?? null}, ${input.gender ?? null}) ON CONFLICT (user_id) DO UPDATE SET salutation = CASE WHEN ${has("salutation")} THEN ${input.salutation ?? null} ELSE participant_profiles.salutation END, first_name = CASE WHEN ${has("firstName")} THEN ${input.firstName ?? null} ELSE participant_profiles.first_name END, last_name = CASE WHEN ${has("lastName")} THEN ${input.lastName ?? null} ELSE participant_profiles.last_name END, gender = CASE WHEN ${has("gender")} THEN ${input.gender ?? null} ELSE participant_profiles.gender END, phone = CASE WHEN ${has("phone")} THEN ${input.phone ?? null} ELSE participant_profiles.phone END, street = CASE WHEN ${has("street")} THEN ${input.street ?? null} ELSE participant_profiles.street END, postal_code = CASE WHEN ${has("postalCode")} THEN ${input.postalCode ?? null} ELSE participant_profiles.postal_code END, city = CASE WHEN ${has("city")} THEN ${input.city ?? null} ELSE participant_profiles.city END, preferred_contact = CASE WHEN ${has("preferredContact")} THEN ${input.preferredContact ?? null} ELSE participant_profiles.preferred_contact END, email_reminders = CASE WHEN ${has("emailReminders")} THEN ${input.emailReminders ?? null} ELSE participant_profiles.email_reminders END, language_preference = CASE WHEN ${has("languagePreference")} THEN ${input.languagePreference ?? null} ELSE participant_profiles.language_preference END, updated_at = now() RETURNING *`;
      for (const note of noteEntries(input.notes)) {
        await transaction`INSERT INTO person_notes (id, user_id, body, created_by) VALUES (${randomUUID()}, ${participantId}, ${note}, ${actor.id})`;
      }
      await transaction`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'participant', ${participantId}, 'updated', 'Teilnehmerdaten geändert', ${JSON.stringify(existing)}, ${JSON.stringify(input)}, ${actor.id})`;
      return { ...user, ...profile };
    });
    return NextResponse.json({ participant: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Teilnehmerdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Diese E-Mail-Adresse wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Teilnehmerdaten konnten nicht geändert werden." }, { status: 500 });
  }
}
