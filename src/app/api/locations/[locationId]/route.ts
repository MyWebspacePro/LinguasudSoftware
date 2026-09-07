import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

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
