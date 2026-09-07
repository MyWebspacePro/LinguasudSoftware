import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

export async function GET() {
  try {
    await requireRole("office");
    const tasks = await db()`
      SELECT t.id, t.task_type, t.title, t.description, t.created_at,
             t.entity_id AS course_id, c.code AS course_code,
             c.language, c.level, actor.name AS actor_name,
             CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacherId', c.teacher_id, 'standardRoomId', c.standard_room_id) END AS course,
             CASE WHEN actor.id IS NULL THEN NULL ELSE json_build_object('id', actor.id, 'name', actor.name, 'email', actor.email) END AS actor
      FROM office_tasks t
      LEFT JOIN courses c ON c.id = t.entity_id AND t.entity_type = 'course'
      LEFT JOIN users actor ON actor.id = t.created_by
      WHERE t.status = 'open'
      ORDER BY t.created_at ASC
      LIMIT 100
    `;
    return NextResponse.json({ tasks, notifications: tasks });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Meldungen konnten nicht geladen werden." }, { status: 500 });
  }
}

const updateTaskSchema = z.object({
  id: z.uuid(),
  status: z.enum(["open", "done"]),
});

export async function PATCH(request: Request) {
  try {
    const actor = await requireRole("office");
    const input = updateTaskSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT * FROM office_tasks WHERE id = ${input.id}`;
    if (!existing) return NextResponse.json({ error: "Aufgabe wurde nicht gefunden." }, { status: 404 });
    const [task] = await sql`
      UPDATE office_tasks SET
        status = ${input.status},
        completed_by = CASE WHEN ${input.status} = 'done' THEN ${actor.id} ELSE NULL END,
        completed_at = CASE WHEN ${input.status} = 'done' THEN now() ELSE NULL END
      WHERE id = ${input.id}
      RETURNING *
    `;
    if (input.status === "done" && existing.status !== "done") {
      await sql`
        INSERT INTO change_history
          (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id)
        VALUES
          (${randomUUID()}, 'office_task', ${input.id}, 'completed',
           'Büro-Aufgabe erledigt', ${JSON.stringify(existing)}, ${JSON.stringify(task)}, ${actor.id})
      `;
    }
    return NextResponse.json({ task });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Aufgabenänderung." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Aufgabe konnte nicht aktualisiert werden." }, { status: 500 });
  }
}
