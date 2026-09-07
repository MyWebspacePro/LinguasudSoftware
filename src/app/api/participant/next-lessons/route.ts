import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

/**
 * Returns only the signed-in participant's future lessons. The enrollment join
 * is deliberately part of the query so a participant can never retrieve a
 * lesson for a course they are not actively enrolled in.
 */
export async function GET() {
  try {
    const participant = await requireRole("participant");
    const sql = db();
    const lessons = await sql`
      SELECT
        lessons.id,
        lessons.starts_at,
        lessons.duration_minutes,
        lessons.status,
        lessons.cancellation_reason,
        courses.id AS course_id,
        courses.code AS course_code,
        courses.language AS course_language,
        courses.level AS course_level,
        rooms.id AS room_id,
        rooms.name AS room_name,
        locations.id AS location_id,
        locations.name AS location_name,
        locations.address AS location_address,
        teachers.id AS teacher_id,
        teachers.name AS teacher_name
      FROM lessons
      JOIN enrollments
        ON enrollments.course_id = lessons.course_id
        AND enrollments.participant_id = ${participant.id}
        AND enrollments.active = true
      JOIN courses ON courses.id = lessons.course_id
      LEFT JOIN rooms ON rooms.id = lessons.room_id
      LEFT JOIN locations ON locations.id = rooms.location_id
      JOIN users AS teachers ON teachers.id = lessons.teacher_id
      WHERE lessons.starts_at >= now()
        AND lessons.status IN ('scheduled', 'cancelled')
      ORDER BY lessons.starts_at ASC, courses.code ASC
    `;

    return NextResponse.json({ lessons });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
    }
    return NextResponse.json({ error: "Nächste Lektionen konnten nicht geladen werden." }, { status: 500 });
  }
}
