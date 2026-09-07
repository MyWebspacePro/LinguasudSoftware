import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { courseLevelSchema } from "@/lib/course-levels";
import { db } from "@/lib/database";

const updateCourseSchema = z.object({
  level: courseLevelSchema.optional(),
  code: z.string().trim().min(5).max(40).regex(/^[A-Z0-9]+$/).optional(),
}).refine((value) => value.level !== undefined || value.code !== undefined, { message: "Mindestens eine Änderung ist erforderlich." });

export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { courseId } = await context.params;
    const input = updateCourseSchema.parse(await request.json());
    if (input.code && user.role !== "office") return NextResponse.json({ error: "Nur das Büro darf Kurskennungen ändern." }, { status: 403 });
    const [course] = user.role === "office"
      ? await db()`SELECT id, teacher_id, language, level FROM courses WHERE id = ${courseId}`
      : await db()`SELECT id, teacher_id, language, level FROM courses WHERE id = ${courseId} AND teacher_id = ${user.id}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    if (input.level !== undefined && input.level !== course.level) {
      const qualificationLevel = input.level.slice(0, 2).replace("+", "");
      const [qualification] = await db()`SELECT 1 FROM teacher_teaching_levels WHERE teacher_id = ${course.teacher_id} AND lower(language) = lower(${course.language}) AND level = ${qualificationLevel} LIMIT 1`;
      if (!qualification) return NextResponse.json({ error: `Die Lehrperson ist für ${course.language} ${input.level} nicht qualifiziert.` }, { status: 409 });
    }
    const sql = db();
    const [updated] = await sql`UPDATE courses SET level = COALESCE(${input.level ?? null}, level), code = COALESCE(${input.code ?? null}, code) WHERE id = ${courseId} RETURNING *`;
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
