import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const breakSchema = z.object({
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  reason: z.string().trim().max(500).nullable().optional(),
}).superRefine((value, context) => {
  if (value.endsOn < value.startsOn) context.addIssue({ code: "custom", path: ["endsOn"], message: "Das Enddatum muss nach dem Startdatum liegen." });
});

type Params = { params: Promise<{ courseId: string }> };

async function visibleCourse(courseId: string, user: { id: string; role: string }) {
  const sql = db();
  const [course] = user.role === "office"
    ? await sql`SELECT id, code FROM courses WHERE id = ${courseId}`
    : await sql`SELECT id, code FROM courses WHERE id = ${courseId} AND teacher_id = ${user.id}`;
  return course ?? null;
}

/** Course interruptions retain their own references and cancel affected future lessons. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireRole("office", "teacher");
    const { courseId } = await params;
    const course = await visibleCourse(courseId, user);
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    const breaks = await db()`SELECT id, course_id, starts_on, ends_on, reason, created_by, created_at FROM course_breaks WHERE course_id = ${courseId} ORDER BY starts_on DESC`;
    return NextResponse.json({ breaks });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Kursunterbrüche konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireRole("office");
    const { courseId } = await params;
    const input = breakSchema.parse(await request.json());
    const sql = db();
    const course = await visibleCourse(courseId, actor);
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    const courseBreak = await sql.begin(async (transaction) => {
      const [created] = await transaction`
        INSERT INTO course_breaks (id, course_id, starts_on, ends_on, reason, created_by)
        VALUES (${randomUUID()}, ${courseId}, ${input.startsOn}, ${input.endsOn}, ${input.reason ?? null}, ${actor.id})
        RETURNING *
      `;
      const reason = input.reason ? `Kursunterbruch: ${input.reason}` : "Kursunterbruch";
      await transaction`
        UPDATE lessons
        SET status = 'cancelled', cancellation_reason = ${reason}
        WHERE course_id = ${courseId}
          AND status = 'scheduled'
          AND starts_at >= now()
          AND (starts_at AT TIME ZONE 'Europe/Zurich')::date BETWEEN ${input.startsOn}::date AND ${input.endsOn}::date
      `;
      await transaction`
        INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, after_data, actor_id)
        VALUES (${randomUUID()}, 'course', ${courseId}, 'break_added', ${`Kursunterbruch ${input.startsOn} bis ${input.endsOn} erfasst`}, ${JSON.stringify(created)}, ${actor.id})
      `;
      return created;
    });
    return NextResponse.json({ break: courseBreak }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Unterbruchsdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Kursunterbruch konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const actor = await requireRole("office");
    const { courseId } = await params;
    const parsed = z.object({ breakId: z.uuid() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Ein gültiger Kursunterbruch ist erforderlich." }, { status: 400 });
    const sql = db();
    const [courseBreak] = await sql`SELECT * FROM course_breaks WHERE id = ${parsed.data.breakId} AND course_id = ${courseId}`;
    if (!courseBreak) return NextResponse.json({ error: "Kursunterbruch wurde nicht gefunden." }, { status: 404 });
    await sql.begin(async (transaction) => {
      await transaction`DELETE FROM course_breaks WHERE id = ${courseBreak.id}`;
      await transaction`
        INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, actor_id)
        VALUES (${randomUUID()}, 'course', ${courseId}, 'break_removed', 'Kursunterbruch entfernt', ${JSON.stringify(courseBreak)}, ${actor.id})
      `;
    });
    return NextResponse.json({ break: courseBreak });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Kursunterbruch konnte nicht entfernt werden." }, { status: 500 });
  }
}
