import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { courseLevelSchema } from "@/lib/course-levels";
import { db } from "@/lib/database";

const createCourseSchema = z.object({
  code: z.string().trim().min(5).max(40).regex(/^[A-Z0-9]+$/),
  language: z.string().trim().min(2).max(60),
  level: courseLevelSchema,
  teacherId: z.uuid(),
  standardRoomId: z.uuid(),
  durationMinutes: z.number().int().min(15).max(360).multipleOf(15),
  startsOn: z.string().date(),
  schedules: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMinutes: z.number().int().min(15).max(360).multipleOf(15),
  })).min(1).max(7).superRefine((schedules, context) => {
    const weekdays = new Set<number>();
    schedules.forEach((schedule, index) => {
      if (weekdays.has(schedule.weekday)) {
        context.addIssue({ code: "custom", message: "Ein Wochentag darf nur einmal angelegt werden.", path: [index, "weekday"] });
      }
      weekdays.add(schedule.weekday);
    });
  }),
});

function firstDateForWeekday(startsOn: string, weekday: number) {
  const date = new Date(`${startsOn}T00:00:00.000Z`);
  const currentWeekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() + (weekday - currentWeekday + 7) % 7);
  return date;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function qualificationLevel(level: string) {
  return level.slice(0, 2).replace("+", "");
}

export async function GET() {
  try {
    const user = await requireRole("office", "teacher");
    const courses = user.role === "office"
      ? await db()`SELECT c.*, users.name AS teacher_name, users.email AS teacher_email, json_build_object('id', users.id, 'name', users.name, 'email', users.email, 'salutation', tp.salutation, 'firstName', tp.first_name, 'lastName', tp.last_name, 'gender', tp.gender) AS teacher, CASE WHEN room.id IS NULL THEN NULL ELSE json_build_object('id', room.id, 'name', room.name, 'capacity', room.capacity, 'location', json_build_object('id', location.id, 'name', location.name, 'address', location.address)) END AS standard_room, COALESCE((SELECT json_agg(json_build_object('id', cs.id, 'courseId', cs.course_id, 'weekday', cs.weekday, 'startTime', cs.start_time, 'durationMinutes', cs.duration_minutes) ORDER BY cs.weekday, cs.start_time) FROM course_schedules cs WHERE cs.course_id = c.id), '[]') AS schedules, (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.active = true) AS active_participant_count FROM courses c JOIN users ON users.id = c.teacher_id LEFT JOIN teacher_profiles tp ON tp.user_id = users.id LEFT JOIN rooms room ON room.id = c.standard_room_id LEFT JOIN locations location ON location.id = room.location_id ORDER BY c.code`
      : await db()`SELECT c.*, users.name AS teacher_name, users.email AS teacher_email, json_build_object('id', users.id, 'name', users.name, 'email', users.email, 'salutation', tp.salutation, 'firstName', tp.first_name, 'lastName', tp.last_name, 'gender', tp.gender) AS teacher, CASE WHEN room.id IS NULL THEN NULL ELSE json_build_object('id', room.id, 'name', room.name, 'capacity', room.capacity, 'location', json_build_object('id', location.id, 'name', location.name, 'address', location.address)) END AS standard_room, COALESCE((SELECT json_agg(json_build_object('id', cs.id, 'courseId', cs.course_id, 'weekday', cs.weekday, 'startTime', cs.start_time, 'durationMinutes', cs.duration_minutes) ORDER BY cs.weekday, cs.start_time) FROM course_schedules cs WHERE cs.course_id = c.id), '[]') AS schedules, (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.active = true) AS active_participant_count FROM courses c JOIN users ON users.id = c.teacher_id LEFT JOIN teacher_profiles tp ON tp.user_id = users.id LEFT JOIN rooms room ON room.id = c.standard_room_id LEFT JOIN locations location ON location.id = room.location_id WHERE c.teacher_id = ${user.id} ORDER BY c.code`;
    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("office");
    const payload = createCourseSchema.parse(await request.json());
    const sql = db();
    const [teacher] = await sql`SELECT id FROM users WHERE id = ${payload.teacherId} AND role = 'teacher'`;
    if (!teacher) return NextResponse.json({ error: "Lehrperson wurde nicht gefunden." }, { status: 404 });
    const [room] = await sql`SELECT id FROM rooms WHERE id = ${payload.standardRoomId} AND active = true`;
    if (!room) return NextResponse.json({ error: "Standardraum ist nicht verfügbar." }, { status: 400 });
    const [qualification] = await sql`
      SELECT 1 FROM teacher_teaching_levels
      WHERE teacher_id = ${payload.teacherId}
        AND lower(language) = lower(${payload.language})
        AND level = ${qualificationLevel(payload.level)}
      LIMIT 1
    `;
    if (!qualification) return NextResponse.json({ error: `Die Lehrperson ist für ${payload.language} ${payload.level} nicht qualifiziert.` }, { status: 409 });
    const course = await sql.begin(async (transaction) => {
      const [createdCourse] = await transaction`
        INSERT INTO courses (id, code, language, level, teacher_id, standard_room_id, duration_minutes, starts_on, status)
        VALUES (${randomUUID()}, ${payload.code}, ${payload.language}, ${payload.level}, ${payload.teacherId}, ${payload.standardRoomId}, ${payload.durationMinutes}, ${payload.startsOn}, 'planned')
        RETURNING *
      `;
      for (const schedule of payload.schedules) {
        await transaction`
          INSERT INTO course_schedules (id, course_id, weekday, start_time, duration_minutes)
          VALUES (${randomUUID()}, ${createdCourse.id}, ${schedule.weekday}, ${schedule.startTime}, ${schedule.durationMinutes})
        `;
        const firstDate = firstDateForWeekday(payload.startsOn, schedule.weekday);
        for (let week = 0; week < 52; week += 1) {
          const lessonDate = new Date(firstDate);
          lessonDate.setUTCDate(firstDate.getUTCDate() + week * 7);
          const localStart = `${isoDate(lessonDate)} ${schedule.startTime}`;
          const [conflict] = await transaction<{ id: string }[]>`
            SELECT id FROM lessons
            WHERE status = 'scheduled'
              AND starts_at < (${localStart}::timestamp AT TIME ZONE 'Europe/Zurich') + ${schedule.durationMinutes} * interval '1 minute'
              AND starts_at + duration_minutes * interval '1 minute' > (${localStart}::timestamp AT TIME ZONE 'Europe/Zurich')
              AND (room_id = ${payload.standardRoomId} OR teacher_id = ${payload.teacherId})
            LIMIT 1
          `;
          if (conflict) throw new Error("COURSE_SCHEDULE_CONFLICT");
          await transaction`
            INSERT INTO lessons (id, course_id, room_id, teacher_id, starts_at, duration_minutes, status)
            VALUES (${randomUUID()}, ${createdCourse.id}, ${payload.standardRoomId}, ${payload.teacherId}, (${localStart}::timestamp AT TIME ZONE 'Europe/Zurich'), ${schedule.durationMinutes}, 'scheduled')
          `;
        }
      }
      return createdCourse;
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Kursdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (error instanceof Error && error.message === "COURSE_SCHEDULE_CONFLICT") return NextResponse.json({ error: "Der Wochenplan kollidiert mit einer bestehenden Raumbelegung oder Lehrperson." }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Diese Kurskennung wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Kurs konnte nicht gespeichert werden." }, { status: 500 });
  }
}
