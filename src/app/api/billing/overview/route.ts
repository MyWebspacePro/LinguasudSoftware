import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

export async function GET() {
  try {
    await requireRole("office");
    const items = await db()`
      SELECT
        enrollments.id AS enrollment_id,
        enrollments.course_id,
        enrollments.participant_id,
        enrollments.billing_type,
        enrollments.credit_lessons,
        enrollments.payment_status,
        participants.name AS participant_name,
        participant_profiles.first_name AS participant_first_name,
        participant_profiles.last_name AS participant_last_name,
        courses.code AS course_code,
        courses.language AS course_language,
        courses.level AS course_level,
        courses.teacher_id,
        courses.standard_room_id,
        count(attendance.id) FILTER (
          WHERE attendance.status IN ('present', 'unexcused', 'online')
        )::int AS consumed_lessons,
        count(attendance.id) FILTER (
          WHERE attendance.status IN ('present', 'unexcused', 'online')
            AND lessons.status = 'completed'
        )::int AS billable_confirmed_lessons
      FROM enrollments
      JOIN users AS participants ON participants.id = enrollments.participant_id
      LEFT JOIN participant_profiles ON participant_profiles.user_id = participants.id
      JOIN courses ON courses.id = enrollments.course_id
      LEFT JOIN attendance ON attendance.enrollment_id = enrollments.id
      LEFT JOIN lessons ON lessons.id = attendance.lesson_id
      WHERE enrollments.active = true
      GROUP BY enrollments.id, participants.name, participant_profiles.first_name, participant_profiles.last_name, courses.code, courses.language, courses.level, courses.teacher_id, courses.standard_room_id
      ORDER BY participants.name, courses.code
    `;
    const overview = items.map((item) => {
      const credit = item.credit_lessons === null ? null : Number(item.credit_lessons);
      const consumed = Number(item.consumed_lessons);
      return {
        ...item,
        consumedLessons: consumed,
        remainingLessons: credit === null ? null : Math.max(credit - consumed, 0),
        lowCredit: credit !== null && credit - consumed <= 2,
        billableConfirmedLessons: Number(item.billable_confirmed_lessons),
      };
    });
    return NextResponse.json({ enrollments: overview });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Abrechnungsübersicht konnte nicht geladen werden." }, { status: 500 });
  }
}
