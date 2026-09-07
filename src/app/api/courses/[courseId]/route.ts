import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { courseLevelSchema } from "@/lib/course-levels";
import { db } from "@/lib/database";

const updateCourseSchema = z.object({
  level: courseLevelSchema.optional(),
  code: z.string().trim().min(5).max(40).regex(/^[A-Z0-9]+$/).optional(),
  status: z.enum(["planned", "active", "paused", "completed", "cancelled"]).optional(),
  durationMinutes: z.number().int().min(15).max(360).multipleOf(15).optional(),
}).refine((value) => value.level !== undefined || value.code !== undefined || value.status !== undefined || value.durationMinutes !== undefined, { message: "Mindestens eine Änderung ist erforderlich." });

/**
 * Return one complete course aggregate. Every related record keeps its
 * database id so the course can be followed into teachers, rooms, lessons,
 * participants, attendance and history without parsing display strings.
 */
export async function GET(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { courseId } = await context.params;
    const sql = db();
    const [course] = user.role === "office"
      ? await sql`SELECT c.*, json_build_object('id', teacher.id, 'name', teacher.name, 'email', teacher.email, 'salutation', tp.salutation, 'firstName', tp.first_name, 'lastName', tp.last_name, 'gender', tp.gender, 'teacherCode', tp.teacher_code) AS teacher, CASE WHEN room.id IS NULL THEN NULL ELSE json_build_object('id', room.id, 'name', room.name, 'capacity', room.capacity, 'location', json_build_object('id', location.id, 'name', location.name, 'address', location.address)) END AS standard_room FROM courses c JOIN users teacher ON teacher.id = c.teacher_id LEFT JOIN teacher_profiles tp ON tp.user_id = teacher.id LEFT JOIN rooms room ON room.id = c.standard_room_id LEFT JOIN locations location ON location.id = room.location_id WHERE c.id = ${courseId}`
      : await sql`SELECT c.*, json_build_object('id', teacher.id, 'name', teacher.name, 'email', teacher.email, 'salutation', tp.salutation, 'firstName', tp.first_name, 'lastName', tp.last_name, 'gender', tp.gender, 'teacherCode', tp.teacher_code) AS teacher, CASE WHEN room.id IS NULL THEN NULL ELSE json_build_object('id', room.id, 'name', room.name, 'capacity', room.capacity, 'location', json_build_object('id', location.id, 'name', location.name, 'address', location.address)) END AS standard_room FROM courses c JOIN users teacher ON teacher.id = c.teacher_id LEFT JOIN teacher_profiles tp ON tp.user_id = teacher.id LEFT JOIN rooms room ON room.id = c.standard_room_id LEFT JOIN locations location ON location.id = room.location_id WHERE c.id = ${courseId} AND c.teacher_id = ${user.id}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    const [schedules, lessons, enrollments, history, qualifications] = await Promise.all([
      sql`SELECT id, course_id, weekday, start_time, duration_minutes, created_at, updated_at FROM course_schedules WHERE course_id = ${courseId} ORDER BY weekday, start_time`,
      sql`SELECT l.*, json_build_object('id', r.id, 'name', r.name, 'capacity', r.capacity, 'location', json_build_object('id', loc.id, 'name', loc.name, 'address', loc.address)) AS room, json_build_object('id', t.id, 'name', t.name, 'email', t.email) AS teacher, (SELECT count(*)::int FROM enrollments e WHERE e.course_id = l.course_id AND e.active = true) AS participant_count FROM lessons l LEFT JOIN rooms r ON r.id = l.room_id LEFT JOIN locations loc ON loc.id = r.location_id JOIN users t ON t.id = l.teacher_id WHERE l.course_id = ${courseId} ORDER BY l.starts_at`,
      sql`SELECT e.*, json_build_object('id', p.id, 'name', p.name, 'email', p.email, 'salutation', pp.salutation, 'firstName', pp.first_name, 'lastName', pp.last_name, 'gender', pp.gender) AS participant, COALESCE((SELECT json_agg(json_build_object('id', a.id, 'lessonId', a.lesson_id, 'status', a.status, 'confirmedBy', a.confirmed_by, 'confirmedAt', a.confirmed_at) ORDER BY a.lesson_id) FROM attendance a JOIN lessons al ON al.id = a.lesson_id WHERE a.enrollment_id = e.id AND al.course_id = e.course_id), '[]') AS attendance, COALESCE((SELECT json_agg(json_build_object('id', pause.id, 'startsOn', pause.starts_on, 'endsOn', pause.ends_on, 'reason', pause.reason) ORDER BY pause.starts_on DESC) FROM enrollment_pauses pause WHERE pause.enrollment_id = e.id), '[]') AS pauses FROM enrollments e JOIN users p ON p.id = e.participant_id LEFT JOIN participant_profiles pp ON pp.user_id = p.id WHERE e.course_id = ${courseId} ORDER BY e.active DESC, p.name`,
      sql`SELECT h.id, h.entity_type, h.entity_id, h.event_type, h.summary, h.before_data, h.after_data, h.actor_id, h.occurred_at, actor.name AS actor_name FROM change_history h LEFT JOIN users actor ON actor.id = h.actor_id WHERE h.entity_type = 'course' AND h.entity_id = ${courseId} ORDER BY h.occurred_at DESC`,
      sql`SELECT teacher_id, language, json_agg(level ORDER BY level) AS levels, min(level) AS from_level, max(level) AS to_level FROM teacher_teaching_levels WHERE teacher_id = ${course.teacher_id} GROUP BY teacher_id, language ORDER BY language`,
    ]);
    return NextResponse.json({ course: { ...course, schedules, lessons, enrollments, history, teacher: { ...course.teacher, qualifications } } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Kurs konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { courseId } = await context.params;
    const input = updateCourseSchema.parse(await request.json());
    if ((input.code || input.status || input.durationMinutes !== undefined) && user.role !== "office") return NextResponse.json({ error: "Nur das Büro darf Kurskennung, Kursstatus und Dauer ändern." }, { status: 403 });
    const [course] = user.role === "office"
      ? await db()`SELECT id, code, teacher_id, language, level, status, duration_minutes FROM courses WHERE id = ${courseId}`
      : await db()`SELECT id, code, teacher_id, language, level, status, duration_minutes FROM courses WHERE id = ${courseId} AND teacher_id = ${user.id}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    if (input.level !== undefined && input.level !== course.level) {
      const qualificationLevel = input.level.slice(0, 2).replace("+", "");
      const [qualification] = await db()`SELECT 1 FROM teacher_teaching_levels WHERE teacher_id = ${course.teacher_id} AND lower(language) = lower(${course.language}) AND level = ${qualificationLevel} LIMIT 1`;
      if (!qualification) return NextResponse.json({ error: `Die Lehrperson ist für ${course.language} ${input.level} nicht qualifiziert.` }, { status: 409 });
    }
    const sql = db();
    if (input.durationMinutes !== undefined && input.durationMinutes !== Number(course.duration_minutes)) {
      const [conflict] = await sql`
        SELECT current_lesson.id
        FROM lessons AS current_lesson
        JOIN lessons AS other_lesson
          ON other_lesson.id <> current_lesson.id
          AND other_lesson.status = 'scheduled'
          AND other_lesson.starts_at < current_lesson.starts_at + ${input.durationMinutes} * interval '1 minute'
          AND other_lesson.starts_at + other_lesson.duration_minutes * interval '1 minute' > current_lesson.starts_at
          AND (other_lesson.room_id = current_lesson.room_id OR other_lesson.teacher_id = current_lesson.teacher_id)
        WHERE current_lesson.course_id = ${courseId}
          AND current_lesson.status = 'scheduled'
          AND current_lesson.starts_at >= now()
        LIMIT 1
      `;
      if (conflict) return NextResponse.json({ error: "Die neue Kursdauer kollidiert mit einer zukünftigen Raumbelegung oder Lehrperson." }, { status: 409 });
    }
    const [updated] = await sql.begin(async (transaction) => {
      const [updatedCourse] = await transaction`UPDATE courses SET level = COALESCE(${input.level ?? null}, level), code = COALESCE(${input.code ?? null}, code), status = COALESCE(${input.status ?? null}, status), duration_minutes = COALESCE(${input.durationMinutes ?? null}, duration_minutes) WHERE id = ${courseId} RETURNING *`;
      if (input.durationMinutes !== undefined && input.durationMinutes !== Number(course.duration_minutes)) {
        await transaction`UPDATE course_schedules SET duration_minutes = ${input.durationMinutes}, updated_at = now() WHERE course_id = ${courseId}`;
        await transaction`UPDATE lessons SET duration_minutes = ${input.durationMinutes} WHERE course_id = ${courseId} AND status = 'scheduled' AND starts_at >= now()`;
      }
      if (input.status === "cancelled") {
        await transaction`UPDATE lessons SET status = 'cancelled', cancellation_reason = 'Kurs abgesagt' WHERE course_id = ${courseId} AND status = 'scheduled' AND starts_at >= now()`;
      }
      return [updatedCourse];
    });
    if (user.role === "office" && input.code !== undefined) {
      // A course-code update is the office's acknowledgement of a teacher's
      // level-change task. Close only the open tasks for this exact course.
      await sql`UPDATE office_tasks SET status = 'done', completed_by = ${user.id}, completed_at = now() WHERE entity_type = 'course' AND entity_id = ${courseId} AND task_type = 'course_level_changed' AND status = 'open'`;
    }
    if (user.role === "teacher" && input.level !== undefined && input.level !== course.level) {
      const historyId = randomUUID();
      const summary = `${user.name} hat ${course.code} von ${course.level} auf ${input.level} geändert`;
      await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${historyId}, 'course', ${courseId}, 'level_changed', ${summary}, ${JSON.stringify({ level: course.level, code: course.code })}, ${JSON.stringify({ level: input.level, code: course.code })}, ${user.id})`;
      await sql`
        INSERT INTO office_tasks
          (id, task_type, entity_type, entity_id, title, description, source_history_id, created_by)
        VALUES
          (${randomUUID()}, 'course_level_changed', 'course', ${courseId},
           'Kursniveau prüfen',
           ${`${summary}. Kursbezeichnung/Kurskennung im Büro prüfen.`},
           ${historyId}, ${user.id})
      `;
    }
    return NextResponse.json({ course: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Kursdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Diese Kurskennung wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Kurs konnte nicht geändert werden." }, { status: 500 });
  }
}
