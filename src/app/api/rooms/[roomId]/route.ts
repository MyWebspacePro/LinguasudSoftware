import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const updateRoomSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  locationId: z.uuid().optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

/** Return one room aggregate with its location, standard-course and lesson references. */
export async function GET(_request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { roomId } = await context.params;
    const sql = db();
    const [room] = await sql`SELECT r.id, r.name, r.capacity, r.active, json_build_object('id', loc.id, 'name', loc.name, 'address', loc.address, 'sortOrder', loc.sort_order) AS location FROM rooms r JOIN locations loc ON loc.id = r.location_id WHERE r.id = ${roomId}`;
    if (!room) return NextResponse.json({ error: "Raum wurde nicht gefunden." }, { status: 404 });
    const [courses, lessons] = await Promise.all([
      sql`SELECT c.id, c.code, c.language, c.level, c.status, c.duration_minutes, c.starts_on, json_build_object('id', t.id, 'name', t.name, 'email', t.email) AS teacher, COALESCE((SELECT json_agg(json_build_object('id', cs.id, 'weekday', cs.weekday, 'startTime', cs.start_time, 'durationMinutes', cs.duration_minutes) ORDER BY cs.weekday, cs.start_time) FROM course_schedules cs WHERE cs.course_id = c.id), '[]') AS schedules, (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.active = true) AS active_participant_count FROM courses c JOIN users t ON t.id = c.teacher_id WHERE c.standard_room_id = ${roomId} AND (${user.role === "office"} OR c.teacher_id = ${user.id}) ORDER BY c.code`,
      sql`SELECT l.id, l.course_id, l.teacher_id, l.room_id, l.starts_at, l.duration_minutes, l.status, l.cancellation_reason, json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status) AS course, json_build_object('id', t.id, 'name', t.name, 'email', t.email) AS teacher, (SELECT count(*)::int FROM enrollments e WHERE e.course_id = l.course_id AND e.active = true) AS participant_count FROM lessons l JOIN courses c ON c.id = l.course_id JOIN users t ON t.id = l.teacher_id WHERE l.room_id = ${roomId} AND (${user.role === "office"} OR l.teacher_id = ${user.id} OR c.teacher_id = ${user.id}) ORDER BY l.starts_at`,
    ]);
    return NextResponse.json({ room: { ...room, courses, lessons } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Raum konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ roomId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { roomId } = await context.params;
    const input = updateRoomSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT * FROM rooms WHERE id = ${roomId}`;
    if (!existing) return NextResponse.json({ error: "Raum wurde nicht gefunden." }, { status: 404 });
    if (input.locationId) {
      const [location] = await sql`SELECT id FROM locations WHERE id = ${input.locationId}`;
      if (!location) return NextResponse.json({ error: "Standort wurde nicht gefunden." }, { status: 404 });
    }
    if (input.capacity !== undefined) {
      const [usage] = await sql<{ count: string }[]>`SELECT count(*) FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.active = true AND c.standard_room_id = ${roomId}`;
      if (Number(usage?.count ?? 0) > input.capacity) return NextResponse.json({ error: "Die neue Kapazität liegt unter der aktuellen Kursbelegung." }, { status: 409 });
    }
    if (input.active === false) {
      const [scheduled] = await sql<{ count: string }[]>`SELECT count(*) FROM lessons WHERE room_id = ${roomId} AND status = 'scheduled' AND starts_at >= now()`;
      if (Number(scheduled?.count ?? 0) > 0) return NextResponse.json({ error: "Der Raum kann nicht deaktiviert werden, solange zukünftige Lektionen zugewiesen sind." }, { status: 409 });
    }
    const has = (key: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, key);
    const [room] = await sql`
      UPDATE rooms SET
        name = CASE WHEN ${has("name")} THEN ${input.name ?? null} ELSE name END,
        capacity = CASE WHEN ${has("capacity")} THEN ${input.capacity ?? null} ELSE capacity END,
        location_id = CASE WHEN ${has("locationId")} THEN ${input.locationId ?? null} ELSE location_id END,
        active = CASE WHEN ${has("active")} THEN ${input.active ?? null} ELSE active END
      WHERE id = ${roomId}
      RETURNING *
    `;
    await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'room', ${roomId}, 'updated', 'Raumdaten geändert', ${JSON.stringify(existing)}, ${JSON.stringify(room)}, ${actor.id})`;
    return NextResponse.json({ room });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Raumdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Dieser Raum existiert bereits an diesem Standort." }, { status: 409 });
    return NextResponse.json({ error: "Raum konnte nicht geändert werden." }, { status: 500 });
  }
}
