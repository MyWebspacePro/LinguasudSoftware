import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";
import { hashPassword } from "@/lib/passwords";

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
const identityFields = z.object({ salutation: salutationSchema.nullable().optional(), firstName: z.string().trim().min(1).max(80).optional(), lastName: z.string().trim().min(1).max(100).optional(), gender: genderSchema.nullable().optional() });
const profileFields = identityFields.extend({ phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(), postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), teacherCode: z.string().trim().max(40).nullable().optional(), teachingLevels: z.array(teachingLevelSchema).max(30).optional(), notes: notesSchema, active: z.boolean().optional(), ratePerLesson: z.number().min(0).max(10000).nullable().optional() });
const createSchema = profileFields.extend({ name: z.string().trim().min(2).max(120).optional(), email: z.email(), password: z.string().min(12).max(256) }).superRefine((value, context) => {
  if ((!value.firstName || !value.lastName) && !value.name) context.addIssue({ code: "custom", path: ["firstName"], message: "Vorname und Nachname sind erforderlich." });
});

function displayName(input: { firstName?: string; lastName?: string; name?: string }, fallback = "Lehrperson") {
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
  if (fromIndex < 0 || toIndex < fromIndex) return [];
  return order.slice(fromIndex, toIndex + 1);
}

export async function GET() {
  try {
    await requireRole("office");
    const teachers = await db()`SELECT u.id, u.name, u.email, u.created_at, p.teacher_code, p.salutation, p.first_name, p.last_name, p.gender, p.phone, p.street, p.postal_code, p.city, p.notes, p.active, p.rate_per_lesson, p.currency, count(c.id)::int AS course_count, COALESCE((SELECT json_agg(json_build_object('id', tc.id, 'code', tc.code, 'language', tc.language, 'level', tc.level, 'status', tc.status, 'standardRoomId', tc.standard_room_id) ORDER BY tc.code) FROM courses tc WHERE tc.teacher_id = u.id), '[]') AS courses, COALESCE((SELECT json_agg(json_build_object('language', levels.language, 'levels', levels.levels, 'fromLevel', levels.from_level, 'toLevel', levels.to_level) ORDER BY levels.language) FROM (SELECT teacher_id, language, json_agg(level ORDER BY level) AS levels, min(level) AS from_level, max(level) AS to_level FROM teacher_teaching_levels GROUP BY teacher_id, language) levels WHERE levels.teacher_id = u.id), '[]') AS teaching_levels, (SELECT COALESCE(json_agg(json_build_object('eventType', h.event_type, 'summary', h.summary, 'occurredAt', h.occurred_at) ORDER BY h.occurred_at DESC), '[]') FROM change_history h WHERE h.entity_type = 'teacher' AND h.entity_id = u.id) AS history, (SELECT COALESCE(json_agg(json_build_object('id', n.id, 'body', n.body, 'createdAt', n.created_at, 'createdBy', creator.name) ORDER BY n.created_at DESC), '[]') FROM person_notes n LEFT JOIN users creator ON creator.id = n.created_by WHERE n.user_id = u.id) AS notes_history FROM users u LEFT JOIN teacher_profiles p ON p.user_id = u.id LEFT JOIN courses c ON c.teacher_id = u.id AND c.status NOT IN ('completed', 'cancelled') WHERE u.role = 'teacher' GROUP BY u.id, p.user_id ORDER BY u.name`;
    return NextResponse.json({ teachers });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Lehrpersonen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("office");
    const input = createSchema.parse(await request.json());
    const sql = db();
    const teacher = await sql.begin(async (transaction) => {
      const fullName = displayName(input);
      const notes = noteEntries(input.notes);
      const [user] = await transaction`INSERT INTO users (id, name, email, role, password_hash) VALUES (${randomUUID()}, ${fullName}, ${input.email.toLowerCase()}, 'teacher', ${hashPassword(input.password)}) RETURNING id, name, email, role`;
      await transaction`INSERT INTO teacher_profiles (user_id, salutation, first_name, last_name, gender, teacher_code, phone, street, postal_code, city, notes, active, rate_per_lesson) VALUES (${user.id}, ${input.salutation ?? null}, ${input.firstName ?? null}, ${input.lastName ?? null}, ${input.gender ?? null}, ${input.teacherCode ?? null}, ${input.phone ?? null}, ${input.street ?? null}, ${input.postalCode ?? null}, ${input.city ?? null}, ${notes.at(-1) ?? null}, ${input.active ?? true}, ${input.ratePerLesson ?? null})`;
      for (const teaching of input.teachingLevels ?? []) {
        for (const level of levelsForTeachingRow(teaching)) {
          await transaction`INSERT INTO teacher_teaching_levels (teacher_id, language, level) VALUES (${user.id}, ${teaching.language}, ${level}) ON CONFLICT DO NOTHING`;
        }
      }
      for (const note of notes) {
        await transaction`INSERT INTO person_notes (id, user_id, body, created_by) VALUES (${randomUUID()}, ${user.id}, ${note}, ${actor.id})`;
      }
      await transaction`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, after_data, actor_id) VALUES (${randomUUID()}, 'teacher', ${user.id}, 'created', 'Lehrperson angelegt', ${JSON.stringify({ ...input, password: undefined })}, ${actor.id})`;
      return user;
    });
    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Lehrpersonendaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "E-Mail-Adresse oder Lehrpersonenkürzel ist bereits vergeben." }, { status: 409 });
    return NextResponse.json({ error: "Lehrperson konnte nicht angelegt werden." }, { status: 500 });
  }
}
