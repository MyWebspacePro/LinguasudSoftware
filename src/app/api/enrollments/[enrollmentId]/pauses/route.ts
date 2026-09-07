import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const pauseSchema = z.object({
  startsOn: z.string().date(),
  endsOn: z.string().date().nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
}).superRefine((value, context) => {
  if (value.endsOn && value.endsOn < value.startsOn) {
    context.addIssue({ code: "custom", path: ["endsOn"], message: "Das Enddatum muss nach dem Startdatum liegen." });
  }
});

type Params = { params: Promise<{ enrollmentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireRole("office", "teacher", "participant");
    const { enrollmentId } = await params;
    const sql = db();
    const [enrollment] = user.role === "office"
      ? await sql`SELECT id FROM enrollments WHERE id = ${enrollmentId}`
      : user.role === "teacher"
        ? await sql`SELECT enrollments.id FROM enrollments JOIN courses ON courses.id = enrollments.course_id WHERE enrollments.id = ${enrollmentId} AND courses.teacher_id = ${user.id}`
        : await sql`SELECT id FROM enrollments WHERE id = ${enrollmentId} AND participant_id = ${user.id}`;
    if (!enrollment) return NextResponse.json({ error: "Kursteilnahme wurde nicht gefunden." }, { status: 404 });
    const pauses = await sql`
      SELECT id, enrollment_id, starts_on, ends_on, reason, created_at
      FROM enrollment_pauses
      WHERE enrollment_id = ${enrollmentId}
      ORDER BY starts_on DESC
    `;
    return NextResponse.json({ pauses });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Pausen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireRole("office");
    const { enrollmentId } = await params;
    const input = pauseSchema.parse(await request.json());
    const sql = db();
    const [enrollment] = await sql`
      SELECT enrollments.id, enrollments.participant_id, enrollments.active,
             participants.name AS participant_name, courses.code AS course_code
      FROM enrollments
      JOIN users AS participants ON participants.id = enrollments.participant_id
      JOIN courses ON courses.id = enrollments.course_id
      WHERE enrollments.id = ${enrollmentId}
    `;
    if (!enrollment) return NextResponse.json({ error: "Kursteilnahme wurde nicht gefunden." }, { status: 404 });
    if (!enrollment.active) return NextResponse.json({ error: "Für eine beendete Teilnahme kann keine Pause erfasst werden." }, { status: 409 });

    const [pause] = await sql.begin(async (transaction) => {
      const [created] = await transaction`
        INSERT INTO enrollment_pauses (id, enrollment_id, starts_on, ends_on, reason, created_by)
        VALUES (${randomUUID()}, ${enrollmentId}, ${input.startsOn}, ${input.endsOn ?? null}, ${input.reason ?? null}, ${actor.id})
        RETURNING *
      `;
      await transaction`
        INSERT INTO change_history
          (id, entity_type, entity_id, event_type, summary, after_data, actor_id)
        VALUES
          (${randomUUID()}, 'enrollment', ${enrollmentId}, 'pause_added',
           ${`Pause für ${enrollment.participant_name} in ${enrollment.course_code} erfasst`},
           ${JSON.stringify(created)}, ${actor.id})
      `;
      return [created];
    });
    return NextResponse.json({ pause }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Pausendaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Pause konnte nicht gespeichert werden." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const actor = await requireRole("office");
    const { enrollmentId } = await params;
    const pauseIdResult = z.object({ pauseId: z.uuid() }).safeParse(await request.json());
    if (!pauseIdResult.success) return NextResponse.json({ error: "Eine gültige Pause ist erforderlich." }, { status: 400 });
    const sql = db();
    const [pause] = await sql`
      SELECT * FROM enrollment_pauses
      WHERE id = ${pauseIdResult.data.pauseId} AND enrollment_id = ${enrollmentId}
    `;
    if (!pause) return NextResponse.json({ error: "Pause wurde nicht gefunden." }, { status: 404 });
    await sql.begin(async (transaction) => {
      await transaction`DELETE FROM enrollment_pauses WHERE id = ${pause.id}`;
      await transaction`
        INSERT INTO change_history
          (id, entity_type, entity_id, event_type, summary, before_data, actor_id)
        VALUES
          (${randomUUID()}, 'enrollment', ${enrollmentId}, 'pause_removed',
           'Teilnahmepause entfernt', ${JSON.stringify(pause)}, ${actor.id})
      `;
    });
    return NextResponse.json({ pause });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Pause konnte nicht entfernt werden." }, { status: 500 });
  }
}
