import "server-only";

import type { AttendanceStatus, LessonAttendanceRow } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  enrollment_id: string;
  participant_id: string;
  participant_name: string;
  status: AttendanceStatus | null;
  attendance_id: string | null;
};

export async function listForLesson(sql: Sql, lessonId: string): Promise<LessonAttendanceRow[]> {
  const rows = await sql<Row[]>`
    SELECT enrollments.id AS enrollment_id, enrollments.participant_id,
           participant.first_name || ' ' || participant.last_name AS participant_name,
           attendance.status, attendance.id AS attendance_id
    FROM lessons
    JOIN enrollments ON enrollments.course_id = lessons.course_id AND enrollments.active = true
    JOIN users participant ON participant.id = enrollments.participant_id
    LEFT JOIN attendance ON attendance.lesson_id = lessons.id AND attendance.enrollment_id = enrollments.id
    WHERE lessons.id = ${lessonId}
    ORDER BY participant.last_name, participant.first_name
  `;
  return rows.map((row) => ({
    enrollmentId: row.enrollment_id,
    participantId: row.participant_id,
    participantName: row.participant_name,
    status: row.status,
    attendanceId: row.attendance_id,
  }));
}

export async function upsert(
  sql: Sql,
  input: { lessonId: string; enrollmentId: string; status: AttendanceStatus; decidedBy: string | null },
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO attendance (lesson_id, enrollment_id, status, decided_by, decided_at)
    VALUES (${input.lessonId}, ${input.enrollmentId}, ${input.status}, ${input.decidedBy}, now())
    ON CONFLICT (lesson_id, enrollment_id)
    DO UPDATE SET status = EXCLUDED.status, decided_by = EXCLUDED.decided_by, decided_at = now(), updated_at = now()
    RETURNING id
  `;
  return row.id;
}

export async function getAttendance(
  sql: Sql,
  lessonId: string,
  enrollmentId: string,
): Promise<{ id: string; status: AttendanceStatus } | null> {
  const [row] = await sql<{ id: string; status: AttendanceStatus }[]>`
    SELECT id, status FROM attendance WHERE lesson_id = ${lessonId} AND enrollment_id = ${enrollmentId}
  `;
  return row ?? null;
}
