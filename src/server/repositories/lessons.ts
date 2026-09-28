import "server-only";

import type { Lesson, LessonStatus } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  course_id: string;
  course_code: string;
  language_name: string;
  level: string;
  room_id: string | null;
  room_name: string | null;
  location_id: string | null;
  location_name: string | null;
  teacher_id: string;
  teacher_name: string;
  starts_at: Date;
  duration_minutes: number;
  status: LessonStatus;
  is_provisional: boolean;
  cancellation_reason: string | null;
  online_link: string | null;
  participant_count: number;
};

const toLesson = (row: Row): Lesson => ({
  id: row.id,
  courseId: row.course_id,
  courseCode: row.course_code,
  languageName: row.language_name,
  level: row.level,
  roomId: row.room_id,
  roomName: row.room_name,
  locationId: row.location_id,
  locationName: row.location_name,
  teacherId: row.teacher_id,
  teacherName: row.teacher_name,
  startsAt: row.starts_at.toISOString(),
  durationMinutes: row.duration_minutes,
  status: row.status,
  isProvisional: row.is_provisional,
  cancellationReason: row.cancellation_reason,
  onlineLink: row.online_link,
  participantCount: row.participant_count,
});

export async function listLessonsByDate(sql: Sql, date: string, teacherId?: string): Promise<Lesson[]> {
  const rows = await sql<Row[]>`
    SELECT lessons.id, lessons.course_id, courses.code AS course_code, languages.name AS language_name, courses.level,
           lessons.room_id, rooms.name AS room_name, locations.id AS location_id, locations.name AS location_name,
           lessons.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
           lessons.starts_at, lessons.duration_minutes, lessons.status, lessons.is_provisional,
           lessons.cancellation_reason, lessons.online_link,
           (SELECT count(*)::int FROM enrollments e WHERE e.course_id = lessons.course_id AND e.active = true) AS participant_count
    FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    JOIN languages ON languages.id = courses.language_id
    JOIN users teacher ON teacher.id = lessons.teacher_id
    LEFT JOIN rooms ON rooms.id = lessons.room_id
    LEFT JOIN locations ON locations.id = rooms.location_id
    WHERE (lessons.starts_at AT TIME ZONE 'Europe/Zurich')::date = ${date}::date
      AND (${teacherId ?? null}::uuid IS NULL OR lessons.teacher_id = ${teacherId ?? null})
    ORDER BY COALESCE(locations.sort_order, 99), rooms.name NULLS FIRST, lessons.starts_at
  `;
  return rows.map(toLesson);
}

export async function listLessonsByDateRange(sql: Sql, from: string, to: string, teacherId?: string): Promise<Lesson[]> {
  const rows = await sql<Row[]>`
    SELECT lessons.id, lessons.course_id, courses.code AS course_code, languages.name AS language_name, courses.level,
           lessons.room_id, rooms.name AS room_name, locations.id AS location_id, locations.name AS location_name,
           lessons.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
           lessons.starts_at, lessons.duration_minutes, lessons.status, lessons.is_provisional,
           lessons.cancellation_reason, lessons.online_link,
           (SELECT count(*)::int FROM enrollments e WHERE e.course_id = lessons.course_id AND e.active = true) AS participant_count
    FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    JOIN languages ON languages.id = courses.language_id
    JOIN users teacher ON teacher.id = lessons.teacher_id
    LEFT JOIN rooms ON rooms.id = lessons.room_id
    LEFT JOIN locations ON locations.id = rooms.location_id
    WHERE (lessons.starts_at AT TIME ZONE 'Europe/Zurich')::date BETWEEN ${from}::date AND ${to}::date
      AND (${teacherId ?? null}::uuid IS NULL OR lessons.teacher_id = ${teacherId ?? null})
    ORDER BY lessons.starts_at, COALESCE(locations.sort_order, 99), rooms.name NULLS FIRST
  `;
  return rows.map(toLesson);
}

export async function listLessonsByCourse(sql: Sql, courseId: string): Promise<Lesson[]> {
  const rows = await sql<Row[]>`
    SELECT lessons.id, lessons.course_id, courses.code AS course_code, languages.name AS language_name, courses.level,
           lessons.room_id, rooms.name AS room_name, locations.id AS location_id, locations.name AS location_name,
           lessons.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
           lessons.starts_at, lessons.duration_minutes, lessons.status, lessons.is_provisional,
           lessons.cancellation_reason, lessons.online_link,
           (SELECT count(*)::int FROM enrollments e WHERE e.course_id = lessons.course_id AND e.active = true) AS participant_count
    FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    JOIN languages ON languages.id = courses.language_id
    JOIN users teacher ON teacher.id = lessons.teacher_id
    LEFT JOIN rooms ON rooms.id = lessons.room_id
    LEFT JOIN locations ON locations.id = rooms.location_id
    WHERE lessons.course_id = ${courseId}
    ORDER BY lessons.starts_at
  `;
  return rows.map(toLesson);
}

export async function getLesson(sql: Sql, id: string): Promise<Lesson | null> {
  const [row] = await sql<Row[]>`
    SELECT lessons.id, lessons.course_id, courses.code AS course_code, languages.name AS language_name, courses.level,
           lessons.room_id, rooms.name AS room_name, locations.id AS location_id, locations.name AS location_name,
           lessons.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
           lessons.starts_at, lessons.duration_minutes, lessons.status, lessons.is_provisional,
           lessons.cancellation_reason, lessons.online_link,
           (SELECT count(*)::int FROM enrollments e WHERE e.course_id = lessons.course_id AND e.active = true) AS participant_count
    FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    JOIN languages ON languages.id = courses.language_id
    JOIN users teacher ON teacher.id = lessons.teacher_id
    LEFT JOIN rooms ON rooms.id = lessons.room_id
    LEFT JOIN locations ON locations.id = rooms.location_id
    WHERE lessons.id = ${id}
  `;
  return row ? toLesson(row) : null;
}

export async function lessonExists(sql: Sql, courseId: string, startsAt: Date): Promise<boolean> {
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM lessons WHERE course_id = ${courseId} AND starts_at = ${startsAt}
  `;
  return (row?.count ?? 0) > 0;
}

export type LessonInsert = {
  courseId: string;
  roomId: string | null;
  teacherId: string;
  startsAt: Date;
  durationMinutes: number;
  status: LessonStatus;
  onlineLink: string | null;
};

export async function insertLesson(sql: Sql, input: LessonInsert): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO lessons (course_id, room_id, teacher_id, starts_at, duration_minutes, status, online_link)
    VALUES (${input.courseId}, ${input.roomId}, ${input.teacherId}, ${input.startsAt}, ${input.durationMinutes}, ${input.status}, ${input.onlineLink})
    RETURNING id
  `;
  return row.id;
}

export type LessonPatch = {
  roomId?: string | null;
  teacherId?: string;
  startsAt?: Date;
  durationMinutes?: number;
  status?: LessonStatus;
  isProvisional?: boolean;
  cancellationReason?: string | null;
  onlineLink?: string | null;
};

export async function updateLesson(sql: Sql, id: string, patch: LessonPatch): Promise<void> {
  const has = (key: keyof LessonPatch) => Object.prototype.hasOwnProperty.call(patch, key);
  await sql`
    UPDATE lessons SET
      room_id = CASE WHEN ${has("roomId")} THEN ${patch.roomId ?? null} ELSE room_id END,
      teacher_id = CASE WHEN ${has("teacherId")} THEN ${patch.teacherId ?? null} ELSE teacher_id END,
      starts_at = CASE WHEN ${has("startsAt")} THEN ${patch.startsAt ?? null} ELSE starts_at END,
      duration_minutes = CASE WHEN ${has("durationMinutes")} THEN ${patch.durationMinutes ?? null} ELSE duration_minutes END,
      status = CASE WHEN ${has("status")} THEN ${patch.status ?? null} ELSE status END,
      is_provisional = CASE WHEN ${has("isProvisional")} THEN ${patch.isProvisional ?? null} ELSE is_provisional END,
      cancellation_reason = CASE WHEN ${has("cancellationReason")} THEN ${patch.cancellationReason ?? null} ELSE cancellation_reason END,
      online_link = CASE WHEN ${has("onlineLink")} THEN ${patch.onlineLink ?? null} ELSE online_link END
    WHERE id = ${id}
  `;
}

export async function deleteLesson(sql: Sql, id: string): Promise<void> {
  await sql`DELETE FROM lessons WHERE id = ${id}`;
}

export async function lessonExistsZurich(sql: Sql, courseId: string, date: string, time: string): Promise<boolean> {
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM lessons
    WHERE course_id = ${courseId}
      AND starts_at = (${date}::date + ${time}::time) AT TIME ZONE 'Europe/Zurich'
  `;
  return (row?.count ?? 0) > 0;
}

export type ZurichLessonInsert = {
  courseId: string;
  roomId: string | null;
  teacherId: string;
  date: string;
  time: string;
  durationMinutes: number;
  status: LessonStatus;
  onlineLink: string | null;
};

export async function insertLessonZurich(sql: Sql, input: ZurichLessonInsert): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO lessons (course_id, room_id, teacher_id, starts_at, duration_minutes, status, online_link)
    VALUES (
      ${input.courseId}, ${input.roomId}, ${input.teacherId},
      (${input.date}::date + ${input.time}::time) AT TIME ZONE 'Europe/Zurich',
      ${input.durationMinutes}, ${input.status}, ${input.onlineLink}
    )
    RETURNING id
  `;
  return row.id;
}
