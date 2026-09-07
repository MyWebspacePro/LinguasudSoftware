import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

export async function GET(request: Request) {
  try {
    const user = await requireRole("office", "teacher");
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    const rooms = await db()`
      SELECT rooms.id, rooms.name, rooms.capacity, rooms.active, locations.id AS location_id, locations.name AS location_name, locations.address AS location_address,
             json_build_object('id', locations.id, 'name', locations.name, 'address', locations.address) AS location,
             COALESCE((SELECT json_agg(json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacher', json_build_object('id', t.id, 'name', t.name, 'email', t.email), 'activeParticipantCount', (SELECT count(*)::int FROM enrollments e WHERE e.course_id = c.id AND e.active = true)) ORDER BY c.code) FROM courses c JOIN users t ON t.id = c.teacher_id WHERE c.standard_room_id = rooms.id AND (${user.role === "office"} OR c.teacher_id = ${user.id})), '[]') AS courses,
             (SELECT count(*)::int FROM lessons l JOIN courses lc ON lc.id = l.course_id WHERE l.room_id = rooms.id AND l.status = 'scheduled' AND (${user.role === "office"} OR l.teacher_id = ${user.id} OR lc.teacher_id = ${user.id})) AS scheduled_lesson_count
      FROM rooms JOIN locations ON locations.id = rooms.location_id
      WHERE rooms.active = true OR (${user.role === "office" && includeInactive})
      ORDER BY locations.sort_order, rooms.name
    `;
    return NextResponse.json({ rooms });
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
}

const createRoomSchema = z.object({
  locationId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const actor = await requireRole("office");
    const input = createRoomSchema.parse(await request.json());
    const sql = db();
    const [location] = await sql`SELECT id FROM locations WHERE id = ${input.locationId}`;
    if (!location) return NextResponse.json({ error: "Standort wurde nicht gefunden." }, { status: 404 });
    const [room] = await sql`INSERT INTO rooms (id, location_id, name, capacity) VALUES (${randomUUID()}, ${input.locationId}, ${input.name}, ${input.capacity}) RETURNING id, location_id, name, capacity, active`;
    await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, after_data, actor_id) VALUES (${randomUUID()}, 'room', ${room.id}, 'created', 'Raum angelegt', ${JSON.stringify(room)}, ${actor.id})`;
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Raumdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Dieser Raum existiert bereits an diesem Standort." }, { status: 409 });
    return NextResponse.json({ error: "Raum konnte nicht angelegt werden." }, { status: 500 });
  }
}
