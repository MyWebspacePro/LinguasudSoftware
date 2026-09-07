import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import postgres from "postgres";
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

function firstDateForWeekday(startsOn: string, weekday: number) {
  const date = new Date(`${startsOn}T00:00:00.000Z`);
  const currentWeekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() + (weekday - currentWeekday + 7) % 7);
  return date;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function createLessonsForSchedule(transaction: postgres.TransactionSql, course: { id: string; teacher_id: string; standard_room_id: string; starts_on: string }, schedule: { weekday: number; startTime: string; durationMinutes: number }) {
  const firstDate = firstDateForWeekday(String(course.starts_on).slice(0, 10), schedule.weekday);
  for (let week = 0; week < 52; week += 1) {
    const lessonDate = new Date(firstDate);
    lessonDate.setUTCDate(firstDate.getUTCDate() + week * 7);
    const localStart = `${isoDate(lessonDate)} ${schedule.startTime}`;
    const [conflict] = await transaction<{ id: string }[]>`
      SELECT id FROM lessons
      WHERE status = 'scheduled'
        AND starts_at < (${localStart}::timestamp AT TIME ZONE 'Europe/Zurich') + ${schedule.durationMinutes} * interval '1 minute'
        AND starts_at + duration_minutes * interval '1 minute' > (${localStart}::timestamp AT TIME ZONE 'Europe/Zurich')
        AND (room_id = ${course.standard_room_id} OR teacher_id = ${course.teacher_id})
      LIMIT 1
    `;
    if (conflict) throw new Error("COURSE_SCHEDULE_CONFLICT");
    await transaction`
      INSERT INTO lessons (id, course_id, room_id, teacher_id, starts_at, duration_minutes, status)
      VALUES (${randomUUID()}, ${course.id}, ${course.standard_room_id}, ${course.teacher_id}, (${localStart}::timestamp AT TIME ZONE 'Europe/Zurich'), ${schedule.durationMinutes}, 'scheduled')
    `;
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Wochenplandaten." }, { status: 400 });
  if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
  if (error instanceof Error && error.message === "COURSE_SCHEDULE_CONFLICT") return NextResponse.json({ error: "Der neue Wochenplan kollidiert mit einer bestehenden Raumbelegung oder Lehrperson." }, { status: 409 });
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Für diesen Wochentag existiert bereits ein Termin." }, { status: 409 });
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
        courses.level AS course_level,
        json_build_object('id', courses.id, 'code', courses.code, 'language', courses.language, 'level', courses.level, 'status', courses.status, 'teacherId', courses.teacher_id, 'standardRoomId', courses.standard_room_id) AS course,
        CASE WHEN rooms.id IS NULL THEN NULL ELSE json_build_object('id', rooms.id, 'name', rooms.name, 'capacity', rooms.capacity, 'location', json_build_object('id', locations.id, 'name', locations.name, 'address', locations.address)) END AS standard_room
      FROM course_schedules
      JOIN courses ON courses.id = course_schedules.course_id
      LEFT JOIN rooms ON rooms.id = courses.standard_room_id
      LEFT JOIN locations ON locations.id = rooms.location_id
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
    const [course] = await sql<{ id: string; teacher_id: string; standard_room_id: string; starts_on: string }[]>`SELECT id, teacher_id, standard_room_id, starts_on FROM courses WHERE id = ${input.courseId}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    if (!course.standard_room_id) return NextResponse.json({ error: "Dem Kurs ist noch kein Standardraum zugewiesen." }, { status: 409 });
    const schedule = await sql.begin(async (transaction) => {
      const [createdSchedule] = await transaction`
        INSERT INTO course_schedules (id, course_id, weekday, start_time, duration_minutes)
        VALUES (${randomUUID()}, ${input.courseId}, ${input.weekday}, ${input.startTime}, ${input.durationMinutes})
        RETURNING *
      `;
      await createLessonsForSchedule(transaction, course, input);
      return createdSchedule;
    });
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
    const [course] = await sql<{ id: string; teacher_id: string; standard_room_id: string; starts_on: string }[]>`SELECT id, teacher_id, standard_room_id, starts_on FROM courses WHERE id = ${input.courseId}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    if (!course.standard_room_id) return NextResponse.json({ error: "Dem Kurs ist noch kein Standardraum zugewiesen." }, { status: 409 });
    const [existing] = await sql<{ id: string; course_id: string; weekday: number }[]>`SELECT id, course_id, weekday FROM course_schedules WHERE id = ${input.id}`;
    if (!existing) return NextResponse.json({ error: "Wochenplaneintrag wurde nicht gefunden." }, { status: 404 });
    if (existing.course_id !== input.courseId) return NextResponse.json({ error: "Der Wochenplaneintrag gehört zu einem anderen Kurs." }, { status: 409 });
    const schedule = await sql.begin(async (transaction) => {
      await transaction`UPDATE lessons SET status = 'cancelled', cancellation_reason = 'Wochenplan geändert' WHERE course_id = ${existing.course_id} AND status = 'scheduled' AND starts_at >= now() AND (EXTRACT(ISODOW FROM starts_at AT TIME ZONE 'Europe/Zurich')::int - 1) = ${existing.weekday}`;
      const [updatedSchedule] = await transaction`
        UPDATE course_schedules
        SET course_id = ${input.courseId}, weekday = ${input.weekday}, start_time = ${input.startTime},
            duration_minutes = ${input.durationMinutes}, updated_at = now()
        WHERE id = ${input.id}
        RETURNING *
      `;
      await createLessonsForSchedule(transaction, course, input);
      return updatedSchedule;
    });
    return NextResponse.json({ schedule });
  } catch (error) {
    return errorResponse(error, "Wochenplan konnte nicht aktualisiert werden.");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole("office");
    const input = deleteScheduleSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql<{ id: string; course_id: string; weekday: number }[]>`SELECT id, course_id, weekday FROM course_schedules WHERE id = ${input.id}`;
    if (!existing) return NextResponse.json({ error: "Wochenplaneintrag wurde nicht gefunden." }, { status: 404 });
    await sql.begin(async (transaction) => {
      const [deleted] = await transaction`DELETE FROM course_schedules WHERE id = ${input.id} RETURNING id`;
      await transaction`UPDATE lessons SET status = 'cancelled', cancellation_reason = 'Wochenplan geändert' WHERE course_id = ${existing.course_id} AND status = 'scheduled' AND starts_at >= now() AND (EXTRACT(ISODOW FROM starts_at AT TIME ZONE 'Europe/Zurich')::int - 1) = ${existing.weekday}`;
      return deleted;
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "Wochenplan konnte nicht gelöscht werden.");
  }
}
