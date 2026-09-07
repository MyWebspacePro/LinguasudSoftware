import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const scheduleFieldsSchema = z.object({
  courseId: z.uuid(),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(timePattern, "Startzeit muss im Format HH:MM angegeben werden."),
  durationMinutes: z.number().int().min(15).max(360).multipleOf(15),
});

const updateScheduleSchema = scheduleFieldsSchema.extend({ id: z.uuid() });
const deleteScheduleSchema = z.object({ id: z.uuid() });

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Wochenplandaten." }, { status: 400 });
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    await requireRole("office");
    const schedules = await db()`
      SELECT
        course_schedules.*,
        courses.code AS course_code,
        courses.language AS course_language,
        courses.level AS course_level
      FROM course_schedules
      JOIN courses ON courses.id = course_schedules.course_id
      ORDER BY courses.code, course_schedules.weekday, course_schedules.start_time
    `;
    return NextResponse.json({ schedules });
  } catch (error) {
    return errorResponse(error, "Wochenplan konnte nicht geladen werden.");
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("office");
    const input = scheduleFieldsSchema.parse(await request.json());
    const sql = db();
    const [course] = await sql<{ id: string }[]>`SELECT id FROM courses WHERE id = ${input.courseId}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });

    const [schedule] = await sql`
      INSERT INTO course_schedules (id, course_id, weekday, start_time, duration_minutes)
      VALUES (${randomUUID()}, ${input.courseId}, ${input.weekday}, ${input.startTime}, ${input.durationMinutes})
      RETURNING *
    `;
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Wochenplan konnte nicht gespeichert werden.");
  }
}

export async function PUT(request: Request) {
  try {
    await requireRole("office");
    const input = updateScheduleSchema.parse(await request.json());
    const sql = db();
    const [course] = await sql<{ id: string }[]>`SELECT id FROM courses WHERE id = ${input.courseId}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });

    const [schedule] = await sql`
      UPDATE course_schedules
      SET course_id = ${input.courseId}, weekday = ${input.weekday}, start_time = ${input.startTime},
          duration_minutes = ${input.durationMinutes}, updated_at = now()
      WHERE id = ${input.id}
      RETURNING *
    `;
    if (!schedule) return NextResponse.json({ error: "Wochenplaneintrag wurde nicht gefunden." }, { status: 404 });
    return NextResponse.json({ schedule });
  } catch (error) {
    return errorResponse(error, "Wochenplan konnte nicht aktualisiert werden.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole("office");
    const input = deleteScheduleSchema.parse(await request.json());
    const [schedule] = await db()`DELETE FROM course_schedules WHERE id = ${input.id} RETURNING id`;
    if (!schedule) return NextResponse.json({ error: "Wochenplaneintrag wurde nicht gefunden." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "Wochenplan konnte nicht gelöscht werden.");
  }
}
