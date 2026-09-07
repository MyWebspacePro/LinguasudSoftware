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
  durationMinutes: z.number().int().min(15).max(360).multipleOf(15),
});

export async function GET(request: Request) {
  try {
    const user = await requireRole("office", "teacher");
    const date = new URL(request.url).searchParams.get("date");
    const lessons = user.role === "office"
      ? await db()`SELECT lessons.*, courses.code, courses.language, courses.level, rooms.name AS room_name, locations.name AS location_name, users.name AS teacher_name FROM lessons JOIN courses ON courses.id = lessons.course_id JOIN rooms ON rooms.id = lessons.room_id JOIN locations ON locations.id = rooms.location_id JOIN users ON users.id = lessons.teacher_id WHERE (${date}::date IS NULL OR lessons.starts_at::date = ${date}::date) ORDER BY lessons.starts_at`
      : await db()`SELECT lessons.*, courses.code, courses.language, courses.level, rooms.name AS room_name, locations.name AS location_name, users.name AS teacher_name FROM lessons JOIN courses ON courses.id = lessons.course_id JOIN rooms ON rooms.id = lessons.room_id JOIN locations ON locations.id = rooms.location_id JOIN users ON users.id = lessons.teacher_id WHERE lessons.teacher_id = ${user.id} AND (${date}::date IS NULL OR lessons.starts_at::date = ${date}::date) ORDER BY lessons.starts_at`;
    return NextResponse.json({ lessons });
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("office");
    const input = createLessonSchema.parse(await request.json());
    const sql = db();
    const endAt = new Date(input.startsAt.getTime() + input.durationMinutes * 60_000);
    const [room] = await sql<{ capacity: number }[]>`SELECT capacity FROM rooms WHERE id = ${input.roomId} AND active = true`;
    const [participants] = await sql<{ count: string }[]>`SELECT count(*) FROM enrollments WHERE course_id = ${input.courseId} AND active = true`;
    if (!room) return NextResponse.json({ error: "Raum ist nicht verfügbar." }, { status: 400 });
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
    const [lesson] = await sql`INSERT INTO lessons (id, course_id, room_id, teacher_id, starts_at, duration_minutes, status) VALUES (${randomUUID()}, ${input.courseId}, ${input.roomId}, ${input.teacherId}, ${input.startsAt}, ${input.durationMinutes}, 'scheduled') RETURNING *`;
    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Lektionsdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Lektion konnte nicht gespeichert werden." }, { status: 500 });
  }
}
