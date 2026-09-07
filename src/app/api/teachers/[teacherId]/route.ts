import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const levelSchema = z.enum(["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
const salutationSchema = z.enum(["frau", "herr", "divers", "keine_angabe"]);
const genderSchema = z.enum(["weiblich", "männlich", "divers", "keine_angabe"]);
const structuredTeachingLevelSchema = z.object({ language: z.string().trim().min(2).max(60), fromLevel: levelSchema, toLevel: levelSchema }).superRefine((value, context) => {
  const order = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
  if (order.indexOf(value.fromLevel) > order.indexOf(value.toLevel)) context.addIssue({ code: "custom", path: ["toLevel"], message: "Das Endniveau muss mindestens dem Startniveau entsprechen." });
});
const legacyTeachingLevelSchema = z.object({ language: z.string().trim().min(2).max(60), levels: z.array(levelSchema).min(1).max(7) });
const teachingLevelSchema = z.union([structuredTeachingLevelSchema, legacyTeachingLevelSchema]);
const notesSchema = z.union([z.string().trim().max(5000), z.array(z.string().trim().min(1).max(5000)).max(50)]).nullable().optional();
const updateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), email: z.email().optional(), salutation: salutationSchema.nullable().optional(), firstName: z.string().trim().min(1).max(80).optional(), lastName: z.string().trim().min(1).max(100).optional(), gender: genderSchema.nullable().optional(), phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(), postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), teacherCode: z.string().trim().max(40).nullable().optional(), teachingLevels: z.array(teachingLevelSchema).max(30).optional(), notes: notesSchema, active: z.boolean().optional(), ratePerLesson: z.number().min(0).max(10000).nullable().optional() }).refine((value) => Object.keys(value).length > 0);

function displayName(input: { firstName?: string | null; lastName?: string | null; name?: string | null }, fallback = "Lehrperson") {
  const structured = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return structured || input.name?.trim() || fallback;
}

function noteEntries(value: string | string[] | null | undefined) {
  return (Array.isArray(value) ? value : value ? [value] : []).map((note) => note.trim()).filter(Boolean);
}

function levelsForTeachingRow(teaching: z.infer<typeof teachingLevelSchema>) {
  if ("levels" in teaching) return [...new Set(teaching.levels)];
  const order = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
  const fromIndex = order.indexOf(teaching.fromLevel);
  const toIndex = order.indexOf(teaching.toLevel);
  return fromIndex >= 0 && toIndex >= fromIndex ? order.slice(fromIndex, toIndex + 1) : [];
}

/** Return a teacher aggregate with qualifications, courses, lessons and notes. */
export async function GET(_request: Request, context: { params: Promise<{ teacherId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { teacherId } = await context.params;
    const sql = db();
    const [teacher] = user.role === "office"
      ? await sql`SELECT u.id, u.name, u.email, u.role, u.created_at, p.teacher_code, p.salutation, p.first_name, p.last_name, p.gender, p.phone, p.street, p.postal_code, p.city, p.notes, p.active, p.rate_per_lesson, p.currency FROM users u LEFT JOIN teacher_profiles p ON p.user_id = u.id WHERE u.id = ${teacherId} AND u.role = 'teacher'`
      : await sql`SELECT u.id, u.name, u.email, u.role, u.created_at, p.teacher_code, p.salutation, p.first_name, p.last_name, p.gender, p.phone, p.street, p.postal_code, p.city, p.notes, p.active, p.rate_per_lesson, p.currency FROM users u LEFT JOIN teacher_profiles p ON p.user_id = u.id WHERE u.id = ${teacherId} AND u.role = 'teacher' AND u.id = ${user.id}`;
    if (!teacher) return NextResponse.json({ error: "Lehrperson wurde nicht gefunden." }, { status: 404 });
    const [qualifications, courses, lessons, history, notes] = await Promise.all([
      sql`SELECT teacher_id, language, json_agg(level ORDER BY level) AS levels, min(level) AS from_level, max(level) AS to_level FROM teacher_teaching_levels WHERE teacher_id = ${teacherId} GROUP BY teacher_id, language ORDER BY language`,
      sql`SELECT c.*, json_build_object('id', room.id, 'name', room.name, 'capacity', room.capacity, 'location', json_build_object('id', loc.id, 'name', loc.name, 'address', loc.address)) AS standard_room, COALESCE((SELECT json_agg(json_build_object('id', cs.id, 'weekday', cs.weekday, 'startTime', cs.start_time, 'durationMinutes', cs.duration_minutes) ORDER BY cs.weekday, cs.start_time) FROM course_schedules cs WHERE cs.course_id = c.id), '[]') AS schedules, (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.active = true) AS active_participant_count FROM courses c LEFT JOIN rooms room ON room.id = c.standard_room_id LEFT JOIN locations loc ON loc.id = room.location_id WHERE c.teacher_id = ${teacherId} ORDER BY c.code`,
      sql`SELECT l.*, json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status) AS course, json_build_object('id', r.id, 'name', r.name, 'capacity', r.capacity, 'location', json_build_object('id', loc.id, 'name', loc.name, 'address', loc.address)) AS room FROM lessons l JOIN courses c ON c.id = l.course_id LEFT JOIN rooms r ON r.id = l.room_id LEFT JOIN locations loc ON loc.id = r.location_id WHERE l.teacher_id = ${teacherId} ORDER BY l.starts_at`,
      sql`SELECT h.id, h.entity_type, h.entity_id, h.event_type, h.summary, h.before_data, h.after_data, h.actor_id, h.occurred_at, actor.name AS actor_name FROM change_history h LEFT JOIN users actor ON actor.id = h.actor_id WHERE h.entity_type = 'teacher' AND h.entity_id = ${teacherId} ORDER BY h.occurred_at DESC`,
      sql`SELECT n.id, n.user_id, n.body, n.created_by, n.created_at, creator.name AS created_by_name FROM person_notes n LEFT JOIN users creator ON creator.id = n.created_by WHERE n.user_id = ${teacherId} ORDER BY n.created_at DESC`,
    ]);
    return NextResponse.json({ teacher: { ...teacher, qualifications, courses, lessons, history, notes, notes_history: notes } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Lehrperson konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ teacherId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { teacherId } = await context.params;
    const input = updateSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT u.id, u.name, u.email, p.* FROM users u LEFT JOIN teacher_profiles p ON p.user_id = u.id WHERE u.id = ${teacherId} AND u.role = 'teacher'`;
    if (!existing) return NextResponse.json({ error: "Lehrperson wurde nicht gefunden." }, { status: 404 });
    const teacher = await sql.begin(async (transaction) => {
      const has = (key: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, key);
      const nextName = has("firstName") || has("lastName") ? displayName({ firstName: input.firstName ?? existing.first_name, lastName: input.lastName ?? existing.last_name }, existing.name) : input.name;
      const [user] = await transaction`UPDATE users SET name = COALESCE(${nextName ?? null}, name), email = COALESCE(${input.email?.toLowerCase() ?? null}, email) WHERE id = ${teacherId} RETURNING id, name, email, role`;
      const [profile] = await transaction`INSERT INTO teacher_profiles (user_id, salutation, first_name, last_name, gender) VALUES (${teacherId}, ${input.salutation ?? null}, ${input.firstName ?? null}, ${input.lastName ?? null}, ${input.gender ?? null}) ON CONFLICT (user_id) DO UPDATE SET salutation = CASE WHEN ${has("salutation")} THEN ${input.salutation ?? null} ELSE teacher_profiles.salutation END, first_name = CASE WHEN ${has("firstName")} THEN ${input.firstName ?? null} ELSE teacher_profiles.first_name END, last_name = CASE WHEN ${has("lastName")} THEN ${input.lastName ?? null} ELSE teacher_profiles.last_name END, gender = CASE WHEN ${has("gender")} THEN ${input.gender ?? null} ELSE teacher_profiles.gender END, phone = CASE WHEN ${has("phone")} THEN ${input.phone ?? null} ELSE teacher_profiles.phone END, street = CASE WHEN ${has("street")} THEN ${input.street ?? null} ELSE teacher_profiles.street END, postal_code = CASE WHEN ${has("postalCode")} THEN ${input.postalCode ?? null} ELSE teacher_profiles.postal_code END, city = CASE WHEN ${has("city")} THEN ${input.city ?? null} ELSE teacher_profiles.city END, teacher_code = CASE WHEN ${has("teacherCode")} THEN ${input.teacherCode ?? null} ELSE teacher_profiles.teacher_code END, active = CASE WHEN ${has("active")} THEN ${input.active ?? null} ELSE teacher_profiles.active END, rate_per_lesson = CASE WHEN ${has("ratePerLesson")} THEN ${input.ratePerLesson ?? null} ELSE teacher_profiles.rate_per_lesson END, updated_at = now() RETURNING *`;
      if (Object.prototype.hasOwnProperty.call(input, "teachingLevels")) {
        await transaction`DELETE FROM teacher_teaching_levels WHERE teacher_id = ${teacherId}`;
        for (const teaching of input.teachingLevels ?? []) {
          for (const level of levelsForTeachingRow(teaching)) {
            await transaction`INSERT INTO teacher_teaching_levels (teacher_id, language, level) VALUES (${teacherId}, ${teaching.language}, ${level}) ON CONFLICT DO NOTHING`;
          }
        }
      }
      const notes = noteEntries(input.notes);
      for (const note of notes) {
        await transaction`INSERT INTO person_notes (id, user_id, body, created_by) VALUES (${randomUUID()}, ${teacherId}, ${note}, ${actor.id})`;
      }
      await transaction`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'teacher', ${teacherId}, 'updated', 'Lehrpersonendaten geändert', ${JSON.stringify(existing)}, ${JSON.stringify(input)}, ${actor.id})`;
      return { ...user, ...profile };
    });
    return NextResponse.json({ teacher });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Lehrpersonendaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Dieses Lehrpersonenkürzel oder diese E-Mail ist bereits vergeben." }, { status: 409 });
    return NextResponse.json({ error: "Lehrpersonendaten konnten nicht geändert werden." }, { status: 500 });
  }
}
