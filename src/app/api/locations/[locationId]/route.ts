import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const updateLocationSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  address: z.string().trim().min(4).max(300).optional(),
  sortOrder: z.number().int().min(1).max(99).optional(),
}).refine((value) => Object.keys(value).length > 0);

/** Return one location aggregate with rooms and their course/lesson references. */
export async function GET(_request: Request, context: { params: Promise<{ locationId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { locationId } = await context.params;
    const sql = db();
    const [location] = await sql`SELECT id, name, address, sort_order, created_at FROM locations WHERE id = ${locationId}`;
    if (!location) return NextResponse.json({ error: "Standort wurde nicht gefunden." }, { status: 404 });
    const rooms = await sql`SELECT r.id, r.location_id, r.name, r.capacity, r.active, COALESCE((SELECT json_agg(json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacher', json_build_object('id', t.id, 'name', t.name, 'email', t.email)) ORDER BY c.code) FROM courses c JOIN users t ON t.id = c.teacher_id WHERE c.standard_room_id = r.id AND (${user.role === "office"} OR c.teacher_id = ${user.id})), '[]') AS courses, COALESCE((SELECT json_agg(json_build_object('id', l.id, 'courseId', l.course_id, 'teacherId', l.teacher_id, 'startsAt', l.starts_at, 'durationMinutes', l.duration_minutes, 'status', l.status, 'course', json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status), 'teacher', json_build_object('id', t.id, 'name', t.name, 'email', t.email)) ORDER BY l.starts_at) FROM lessons l JOIN courses c ON c.id = l.course_id JOIN users t ON t.id = l.teacher_id WHERE l.room_id = r.id AND (${user.role === "office"} OR l.teacher_id = ${user.id} OR c.teacher_id = ${user.id})), '[]') AS lessons FROM rooms r WHERE r.location_id = ${locationId} ORDER BY r.name`;
    return NextResponse.json({ location: { ...location, rooms } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Standort konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ locationId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { locationId } = await context.params;
    const input = updateLocationSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT * FROM locations WHERE id = ${locationId}`;
    if (!existing) return NextResponse.json({ error: "Standort wurde nicht gefunden." }, { status: 404 });
    const has = (key: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, key);
    const [location] = await sql`
      UPDATE locations SET
        name = CASE WHEN ${has("name")} THEN ${input.name ?? null} ELSE name END,
        address = CASE WHEN ${has("address")} THEN ${input.address ?? null} ELSE address END,
        sort_order = CASE WHEN ${has("sortOrder")} THEN ${input.sortOrder ?? null} ELSE sort_order END
      WHERE id = ${locationId}
      RETURNING *
    `;
    await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'location', ${locationId}, 'updated', 'Standortdaten geändert', ${JSON.stringify(existing)}, ${JSON.stringify(location)}, ${actor.id})`;
    return NextResponse.json({ location });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Standortdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Name oder Reihenfolge wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Standort konnte nicht geändert werden." }, { status: 500 });
  }
}
