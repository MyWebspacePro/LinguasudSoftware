import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const createLessonSchema = z.object({
  courseId: z.uuid(),
  roomId: z.uuid(),
  teacherId: z.uuid(),
  startsAt: z.coerce.date(),
});

function qualificationLevel(level: string) {
  return level.slice(0, 2).replace("+", "");
}

export async function GET(request: Request) {
  try {
    const user = await requireRole("office", "teacher");
    const date = new URL(request.url).searchParams.get("date");
    const lessons = user.role === "office"
      ? await db()`SELECT lessons.*, courses.code, courses.language, courses.level, standard_location.id AS standard_location_id, standard_location.name AS standard_location_name, rooms.name AS room_name, locations.name AS location_name, users.name AS teacher_name, json_build_object('id', courses.id, 'code', courses.code, 'language', courses.language, 'level', courses.level, 'status', courses.status, 'teacherId', courses.teacher_id, 'standardRoomId', courses.standard_room_id) AS course, json_build_object('id', rooms.id, 'name', rooms.name, 'capacity', rooms.capacity, 'location', json_build_object('id', locations.id, 'name', locations.name, 'address', locations.address)) AS room, json_build_object('id', users.id, 'name', users.name, 'email', users.email) AS teacher, (SELECT count(*)::int FROM enrollments WHERE course_id = courses.id AND active = true) AS participant_count FROM lessons JOIN courses ON courses.id = lessons.course_id LEFT JOIN rooms standard_room ON standard_room.id = courses.standard_room_id LEFT JOIN locations standard_location ON standard_location.id = standard_room.location_id JOIN rooms ON rooms.id = lessons.room_id JOIN locations ON locations.id = rooms.location_id JOIN users ON users.id = lessons.teacher_id WHERE (${date}::date IS NULL OR (lessons.starts_at AT TIME ZONE 'Europe/Zurich')::date = ${date}::date) ORDER BY lessons.starts_at`
      : await db()`SELECT lessons.*, courses.code, courses.language, courses.level, standard_location.id AS standard_location_id, standard_location.name AS standard_location_name, rooms.name AS room_name, locations.name AS location_name, users.name AS teacher_name, json_build_object('id', courses.id, 'code', courses.code, 'language', courses.language, 'level', courses.level, 'status', courses.status, 'teacherId', courses.teacher_id, 'standardRoomId', courses.standard_room_id) AS course, json_build_object('id', rooms.id, 'name', rooms.name, 'capacity', rooms.capacity, 'location', json_build_object('id', locations.id, 'name', locations.name, 'address', locations.address)) AS room, json_build_object('id', users.id, 'name', users.name, 'email', users.email) AS teacher, (SELECT count(*)::int FROM enrollments WHERE course_id = courses.id AND active = true) AS participant_count FROM lessons JOIN courses ON courses.id = lessons.course_id LEFT JOIN rooms standard_room ON standard_room.id = courses.standard_room_id LEFT JOIN locations standard_location ON standard_location.id = standard_room.location_id JOIN rooms ON rooms.id = lessons.room_id JOIN locations ON locations.id = rooms.location_id JOIN users ON users.id = lessons.teacher_id WHERE lessons.teacher_id = ${user.id} AND (${date}::date IS NULL OR (lessons.starts_at AT TIME ZONE 'Europe/Zurich')::date = ${date}::date) ORDER BY lessons.starts_at`;
    return NextResponse.json({ lessons });
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("office");
    const input = createLessonSchema.parse(await request.json());
    const sql = db();
    const [course] = await sql<{ id: string; language: string; level: string; duration_minutes: number; standard_location_id: string | null; standard_location_name: string | null }[]>`SELECT c.id, c.language, c.level, c.duration_minutes, standard_location.id AS standard_location_id, standard_location.name AS standard_location_name FROM courses c LEFT JOIN rooms standard_room ON standard_room.id = c.standard_room_id LEFT JOIN locations standard_location ON standard_location.id = standard_room.location_id WHERE c.id = ${input.courseId}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    const endAt = new Date(input.startsAt.getTime() + Number(course.duration_minutes) * 60_000);
    const [courseBreak] = await sql`
      SELECT id
      FROM course_breaks
      WHERE course_id = ${input.courseId}
        AND (${input.startsAt} AT TIME ZONE 'Europe/Zurich')::date BETWEEN starts_on AND ends_on
      LIMIT 1
    `;
    if (courseBreak) return NextResponse.json({ error: "In einem Kursunterbruch kann keine Lektion geplant werden." }, { status: 409 });
    const [teacher] = await sql`SELECT users.id FROM users LEFT JOIN teacher_profiles ON teacher_profiles.user_id = users.id WHERE users.id = ${input.teacherId} AND users.role = 'teacher' AND COALESCE(teacher_profiles.active, true) = true`;
    if (!teacher) return NextResponse.json({ error: "Lehrperson wurde nicht gefunden." }, { status: 404 });
    const [qualification] = await sql`SELECT 1 FROM teacher_teaching_levels WHERE teacher_id = ${input.teacherId} AND lower(language) = lower(${course.language}) AND level = ${qualificationLevel(course.level)} LIMIT 1`;
    if (!qualification) return NextResponse.json({ error: `Die Lehrperson ist für ${course.language} ${course.level} nicht qualifiziert.` }, { status: 409 });
    const [room] = await sql<{ capacity: number; location_id: string }[]>`SELECT capacity, location_id FROM rooms WHERE id = ${input.roomId} AND active = true`;
    const [participants] = await sql<{ count: string }[]>`SELECT count(*) FROM enrollments WHERE course_id = ${input.courseId} AND active = true`;
    if (!room) return NextResponse.json({ error: "Raum ist nicht verfügbar." }, { status: 400 });
    if (course.standard_location_name === "Winterthur" && room.location_id !== course.standard_location_id) return NextResponse.json({ error: "Winterthur-Kurse müssen am Standort Winterthur bleiben." }, { status: 409 });
    if (Number(participants?.count ?? 0) > room.capacity) return NextResponse.json({ error: "Raum hat zu wenige Plätze." }, { status: 409 });
    const conflicts = await sql`
      SELECT id, room_id, teacher_id FROM lessons
      WHERE status <> 'cancelled'
        AND starts_at < ${endAt}
        AND starts_at + duration_minutes * interval '1 minute' > ${input.startsAt}
        AND (room_id = ${input.roomId} OR teacher_id = ${input.teacherId})
    `;
    if (conflicts.some((item) => item.room_id === input.roomId)) return NextResponse.json({ error: "Der Raum ist bereits belegt." }, { status: 409 });
    if (conflicts.length) return NextResponse.json({ error: "Die Lehrperson ist bereits eingeplant." }, { status: 409 });
    const [lesson] = await sql`INSERT INTO lessons (id, course_id, room_id, teacher_id, starts_at, duration_minutes, status) VALUES (${randomUUID()}, ${input.courseId}, ${input.roomId}, ${input.teacherId}, ${input.startsAt}, ${course.duration_minutes}, 'scheduled') RETURNING *`;
    await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, after_data, actor_id) VALUES (${randomUUID()}, 'lesson', ${lesson.id}, 'created', 'Lektion angelegt', ${JSON.stringify(lesson)}, ${actor.id})`;
    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Lektionsdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Lektion konnte nicht gespeichert werden." }, { status: 500 });
  }
}
