import "server-only";

import type { AbsenceStatus, StaffAbsence, TeacherAbsence, TeacherAbsenceAction } from "@/lib/types";
import type { Sql } from "@/server/db";

type TeacherRow = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  course_id: string | null;
  course_code: string | null;
  starts_on: string;
  ends_on: string;
  action: TeacherAbsenceAction;
  status: AbsenceStatus;
  note: string | null;
  created_at: Date;
};

const toTeacherAbsence = (row: TeacherRow): TeacherAbsence => ({
  id: row.id,
  teacherId: row.teacher_id,
  teacherName: row.teacher_name,
  courseId: row.course_id,
  courseCode: row.course_code,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  action: row.action,
  status: row.status,
  note: row.note,
  createdAt: row.created_at.toISOString(),
});

export type TeacherAbsenceFilter = { teacherId?: string; status?: AbsenceStatus };

export async function listTeacherAbsences(sql: Sql, filter: TeacherAbsenceFilter = {}): Promise<TeacherAbsence[]> {
  const rows = await sql<TeacherRow[]>`
    SELECT absences.id, absences.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
           absences.course_id, courses.code AS course_code,
           to_char(absences.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(absences.ends_on, 'YYYY-MM-DD') AS ends_on,
           absences.action, absences.status, absences.note, absences.created_at
    FROM teacher_absences absences
    JOIN users teacher ON teacher.id = absences.teacher_id
    LEFT JOIN courses ON courses.id = absences.course_id
    WHERE (${filter.teacherId ?? null}::uuid IS NULL OR absences.teacher_id = ${filter.teacherId ?? null})
      AND (${filter.status ?? null}::text IS NULL OR absences.status = ${filter.status ?? null})
    ORDER BY (absences.status <> 'requested'), absences.starts_on DESC
  `;
  return rows.map(toTeacherAbsence);
}

export async function getTeacherAbsence(sql: Sql, id: string): Promise<TeacherAbsence | null> {
  const rows = await listTeacherAbsences(sql);
  return rows.find((row) => row.id === id) ?? null;
}

export async function insertTeacherAbsence(
  sql: Sql,
  input: { teacherId: string; courseId: string | null; startsOn: string; endsOn: string; action: TeacherAbsenceAction; note: string | null },
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO teacher_absences (teacher_id, course_id, starts_on, ends_on, action, note)
    VALUES (${input.teacherId}, ${input.courseId}, ${input.startsOn}, ${input.endsOn}, ${input.action}, ${input.note})
    RETURNING id
  `;
  return row.id;
}

export async function setTeacherAbsenceStatus(sql: Sql, id: string, status: AbsenceStatus, decidedBy: string): Promise<void> {
  await sql`UPDATE teacher_absences SET status = ${status}, decided_by = ${decidedBy} WHERE id = ${id}`;
}

type StaffRow = {
  id: string;
  user_id: string;
  user_name: string;
  starts_on: string;
  ends_on: string;
  status: AbsenceStatus;
  kind: string | null;
  note: string | null;
  created_at: Date;
};

export async function listStaffAbsences(sql: Sql): Promise<StaffAbsence[]> {
  const rows = await sql<StaffRow[]>`
    SELECT absences.id, absences.user_id, staff.first_name || ' ' || staff.last_name AS user_name,
           to_char(absences.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(absences.ends_on, 'YYYY-MM-DD') AS ends_on,
           absences.status, absences.kind, absences.note, absences.created_at
    FROM staff_absences absences
    JOIN users staff ON staff.id = absences.user_id
    ORDER BY (absences.status <> 'requested'), absences.starts_on DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    kind: row.kind,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function insertStaffAbsence(
  sql: Sql,
  input: { userId: string; startsOn: string; endsOn: string; kind: string | null; note: string | null },
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO staff_absences (user_id, starts_on, ends_on, kind, note)
    VALUES (${input.userId}, ${input.startsOn}, ${input.endsOn}, ${input.kind}, ${input.note})
    RETURNING id
  `;
  return row.id;
}

export async function setStaffAbsenceStatus(sql: Sql, id: string, status: AbsenceStatus, decidedBy: string): Promise<void> {
  await sql`UPDATE staff_absences SET status = ${status}, decided_by = ${decidedBy} WHERE id = ${id}`;
}
