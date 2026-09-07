import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const updateLessonSchema = z.object({
  roomId: z.uuid(),
  startsAt: z.coerce.date(),
});

export async function PATCH(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  try {
    const user = await requireRole("office");
    const { lessonId } = await context.params;
    const input = updateLessonSchema.parse(await request.json());
    const sql = db();
    const [lesson] = await sql<{ id: string; teacher_id: string; duration_minutes: number }[]>`SELECT id, teacher_id, duration_minutes FROM lessons WHERE id = ${lessonId} AND status = 'scheduled'`;
    if (!lesson) return NextResponse.json({ error: "Lektion wurde nicht gefunden." }, { status: 404 });
    const [room] = await sql<{ capacity: number }[]>`SELECT capacity FROM rooms WHERE id = ${input.roomId} AND active = true`;
    if (!room) return NextResponse.json({ error: "Raum ist nicht verfügbar." }, { status: 400 });
    const [participants] = await sql<{ count: string }[]>`SELECT count(*) FROM enrollments JOIN lessons ON lessons.course_id = enrollments.course_id WHERE lessons.id = ${lessonId} AND enrollments.active = true`;
    if (Number(participants?.count ?? 0) > room.capacity) return NextResponse.json({ error: "Raum hat zu wenige Plätze." }, { status: 409 });
    const endAt = new Date(input.startsAt.getTime() + Number(lesson.duration_minutes) * 60_000);
    const conflicts = await sql`SELECT id, room_id FROM lessons WHERE id <> ${lessonId} AND status = 'scheduled' AND starts_at < ${endAt} AND starts_at + duration_minutes * interval '1 minute' > ${input.startsAt} AND (room_id = ${input.roomId} OR teacher_id = ${lesson.teacher_id})`;
    if (conflicts.some((item) => item.room_id === input.roomId)) return NextResponse.json({ error: "Der Raum ist bereits belegt." }, { status: 409 });
    if (conflicts.length) return NextResponse.json({ error: "Die Lehrperson ist bereits eingeplant." }, { status: 409 });
    const [updated] = await sql`UPDATE lessons SET room_id = ${input.roomId}, starts_at = ${input.startsAt} WHERE id = ${lessonId} RETURNING *`;
    return NextResponse.json({ lesson: updated, changedBy: user.id });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Lektionsdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Lektion konnte nicht verschoben werden." }, { status: 500 });
  }
}
