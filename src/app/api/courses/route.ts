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
  standardRoomId: z.uuid().nullable(),
  durationMinutes: z.number().int().min(15).max(360).multipleOf(15),
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

export async function GET() {
  try {
    const user = await requireRole("office", "teacher");
    const courses = user.role === "office"
      ? await db()`SELECT courses.*, users.name AS teacher_name FROM courses JOIN users ON users.id = courses.teacher_id ORDER BY courses.code`
      : await db()`SELECT courses.*, users.name AS teacher_name FROM courses JOIN users ON users.id = courses.teacher_id WHERE courses.teacher_id = ${user.id} ORDER BY courses.code`;
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
    const course = await sql.begin(async (transaction) => {
      const [createdCourse] = await transaction`
        INSERT INTO courses (id, code, language, level, teacher_id, standard_room_id, duration_minutes, status)
        VALUES (${randomUUID()}, ${payload.code}, ${payload.language}, ${payload.level}, ${payload.teacherId}, ${payload.standardRoomId}, ${payload.durationMinutes}, 'planned')
        RETURNING *
      `;
      for (const schedule of payload.schedules) {
        await transaction`
          INSERT INTO course_schedules (id, course_id, weekday, start_time, duration_minutes)
          VALUES (${randomUUID()}, ${createdCourse.id}, ${schedule.weekday}, ${schedule.startTime}, ${schedule.durationMinutes})
        `;
      }
      return createdCourse;
    });
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Kursdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Kurs konnte nicht gespeichert werden." }, { status: 500 });
  }
}
