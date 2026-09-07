import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

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
