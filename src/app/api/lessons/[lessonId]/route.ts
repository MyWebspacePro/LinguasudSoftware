import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const moveLessonSchema = z.object({
  roomId: z.uuid(),
  startsAt: z.coerce.date(),
  teacherId: z.uuid().optional(),
});
const cancelLessonSchema = z.object({
  status: z.literal("cancelled"),
  cancellationReason: z.string().trim().min(2).max(500).optional(),
});
const documentLessonSchema = z.object({
  lessonContent: z.string().trim().max(12_000).nullable().optional(),
  homework: z.string().trim().max(8_000).nullable().optional(),
  teacherNotes: z.string().trim().max(8_000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "Mindestens ein Lektionsfeld ist erforderlich." });

function qualificationLevel(level: string) {
  return level.slice(0, 2).replace("+", "");
}

/** Return one lesson aggregate with its course, room, teacher and attendance references. */
export async function GET(_request: Request, context: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { lessonId } = await context.params;
    const sql = db();
    const [lesson] = user.role === "office"
      ? await sql`SELECT l.*, json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacherId', c.teacher_id, 'standardRoomId', c.standard_room_id) AS course, CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object('id', r.id, 'name', r.name, 'capacity', r.capacity, 'location', json_build_object('id', loc.id, 'name', loc.name, 'address', loc.address)) END AS room, json_build_object('id', t.id, 'name', t.name, 'email', t.email) AS teacher FROM lessons l JOIN courses c ON c.id = l.course_id LEFT JOIN rooms r ON r.id = l.room_id LEFT JOIN locations loc ON loc.id = r.location_id JOIN users t ON t.id = l.teacher_id WHERE l.id = ${lessonId}`
      : await sql`SELECT l.*, json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacherId', c.teacher_id, 'standardRoomId', c.standard_room_id) AS course, CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object('id', r.id, 'name', r.name, 'capacity', r.capacity, 'location', json_build_object('id', loc.id, 'name', loc.name, 'address', loc.address)) END AS room, json_build_object('id', t.id, 'name', t.name, 'email', t.email) AS teacher FROM lessons l JOIN courses c ON c.id = l.course_id LEFT JOIN rooms r ON r.id = l.room_id LEFT JOIN locations loc ON loc.id = r.location_id JOIN users t ON t.id = l.teacher_id WHERE l.id = ${lessonId} AND l.teacher_id = ${user.id}`;
    if (!lesson) return NextResponse.json({ error: "Lektion wurde nicht gefunden." }, { status: 404 });
    const participants = await sql`SELECT e.id AS enrollment_id, e.course_id, e.participant_id, e.billing_type, e.credit_lessons, e.payment_status, e.active, json_build_object('id', p.id, 'name', p.name, 'email', p.email, 'firstName', pp.first_name, 'lastName', pp.last_name) AS participant, a.id AS attendance_id, a.status AS attendance_status, a.confirmed_by, a.confirmed_at FROM enrollments e JOIN users p ON p.id = e.participant_id LEFT JOIN participant_profiles pp ON pp.user_id = p.id LEFT JOIN attendance a ON a.enrollment_id = e.id AND a.lesson_id = ${lessonId} WHERE e.course_id = ${lesson.course_id} ORDER BY p.name`;
    return NextResponse.json({ lesson: { ...lesson, participants } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Lektion konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { lessonId } = await context.params;
    const rawInput: unknown = await request.json();
    const sql = db();
    const documentationResult = documentLessonSchema.safeParse(rawInput);
    if (documentationResult.success) {
      const input = documentationResult.data;
      const [existing] = user.role === "office"
        ? await sql`SELECT id, lesson_content, homework, teacher_notes FROM lessons WHERE id = ${lessonId} AND status <> 'cancelled'`
        : await sql`SELECT id, lesson_content, homework, teacher_notes FROM lessons WHERE id = ${lessonId} AND teacher_id = ${user.id} AND status <> 'cancelled'`;
      if (!existing) return NextResponse.json({ error: "Lektion wurde nicht gefunden." }, { status: 404 });
      const has = (key: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, key);
      const [updated] = await sql`
        UPDATE lessons SET
          lesson_content = CASE WHEN ${has("lessonContent")} THEN ${input.lessonContent ?? null} ELSE lesson_content END,
          homework = CASE WHEN ${has("homework")} THEN ${input.homework ?? null} ELSE homework END,
          teacher_notes = CASE WHEN ${has("teacherNotes")} THEN ${input.teacherNotes ?? null} ELSE teacher_notes END
        WHERE id = ${lessonId}
        RETURNING *
      `;
      await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'lesson', ${lessonId}, 'documentation_updated', 'Lektionsdokumentation aktualisiert', ${JSON.stringify(existing)}, ${JSON.stringify(input)}, ${user.id})`;
      return NextResponse.json({ lesson: updated });
    }
    if (user.role !== "office") return NextResponse.json({ error: "Nur das Büro darf Lektionen verschieben oder absagen." }, { status: 403 });
    const input = z.union([moveLessonSchema, cancelLessonSchema]).parse(rawInput);
    const [lesson] = await sql<{ id: string; course_id: string; room_id: string | null; starts_at: string; teacher_id: string; duration_minutes: number; language: string; level: string; standard_location_id: string | null; standard_location_name: string | null }[]>`SELECT l.id, l.course_id, l.room_id, l.starts_at, l.teacher_id, l.duration_minutes, c.language, c.level, standard_location.id AS standard_location_id, standard_location.name AS standard_location_name FROM lessons l JOIN courses c ON c.id = l.course_id LEFT JOIN rooms standard_room ON standard_room.id = c.standard_room_id LEFT JOIN locations standard_location ON standard_location.id = standard_room.location_id WHERE l.id = ${lessonId} AND l.status = 'scheduled'`;
    if (!lesson) return NextResponse.json({ error: "Lektion wurde nicht gefunden." }, { status: 404 });
    if ("status" in input) {
      const [updated] = await sql`UPDATE lessons SET status = 'cancelled', cancellation_reason = ${input.cancellationReason ?? null} WHERE id = ${lessonId} RETURNING *`;
      await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'lesson', ${lessonId}, 'cancelled', 'Lektion abgesagt', ${JSON.stringify({ status: "scheduled", cancellationReason: null })}, ${JSON.stringify({ status: "cancelled", cancellationReason: input.cancellationReason ?? null })}, ${user.id})`;
      return NextResponse.json({ lesson: updated, changedBy: user.id });
    }
    const [room] = await sql<{ capacity: number; location_id: string }[]>`SELECT capacity, location_id FROM rooms WHERE id = ${input.roomId} AND active = true`;
    if (!room) return NextResponse.json({ error: "Raum ist nicht verfügbar." }, { status: 400 });
    if (lesson.standard_location_name === "Winterthur" && room.location_id !== lesson.standard_location_id) return NextResponse.json({ error: "Winterthur-Kurse müssen am Standort Winterthur bleiben." }, { status: 409 });
    const targetTeacherId = input.teacherId ?? lesson.teacher_id;
    if (targetTeacherId !== lesson.teacher_id) {
      const [teacher] = await sql`SELECT id FROM users WHERE id = ${targetTeacherId} AND role = 'teacher'`;
      if (!teacher) return NextResponse.json({ error: "Vertretende Lehrperson wurde nicht gefunden." }, { status: 404 });
      const [qualification] = await sql`SELECT 1 FROM teacher_teaching_levels WHERE teacher_id = ${targetTeacherId} AND lower(language) = lower(${lesson.language}) AND level = ${qualificationLevel(lesson.level)} LIMIT 1`;
      if (!qualification) return NextResponse.json({ error: `Die Vertretung ist für ${lesson.language} ${lesson.level} nicht qualifiziert.` }, { status: 409 });
    }
    const [participants] = await sql<{ count: string }[]>`SELECT count(*) FROM enrollments JOIN lessons ON lessons.course_id = enrollments.course_id WHERE lessons.id = ${lessonId} AND enrollments.active = true`;
    if (Number(participants?.count ?? 0) > room.capacity) return NextResponse.json({ error: "Raum hat zu wenige Plätze." }, { status: 409 });
    const endAt = new Date(input.startsAt.getTime() + Number(lesson.duration_minutes) * 60_000);
    const conflicts = await sql`SELECT id, room_id FROM lessons WHERE id <> ${lessonId} AND status = 'scheduled' AND starts_at < ${endAt} AND starts_at + duration_minutes * interval '1 minute' > ${input.startsAt} AND (room_id = ${input.roomId} OR teacher_id = ${targetTeacherId})`;
    if (conflicts.some((item) => item.room_id === input.roomId)) return NextResponse.json({ error: "Der Raum ist bereits belegt." }, { status: 409 });
    if (conflicts.length) return NextResponse.json({ error: "Die Lehrperson ist bereits eingeplant." }, { status: 409 });
    const [updated] = await sql`UPDATE lessons SET room_id = ${input.roomId}, starts_at = ${input.startsAt}, teacher_id = ${targetTeacherId} WHERE id = ${lessonId} RETURNING *`;
    await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'lesson', ${lessonId}, 'updated', 'Lektion verschoben oder Vertretung geändert', ${JSON.stringify({ roomId: lesson.room_id, startsAt: lesson.starts_at, teacherId: lesson.teacher_id })}, ${JSON.stringify({ roomId: input.roomId, startsAt: input.startsAt, teacherId: targetTeacherId })}, ${user.id})`;
    return NextResponse.json({ lesson: updated, changedBy: user.id });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Lektionsdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Lektion konnte nicht verschoben werden." }, { status: 500 });
  }
}
