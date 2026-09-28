import "server-only";

import type { Course, CourseLevel, CourseSchedule, CourseStatus } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  code: string;
  language_id: string;
  language_name: string;
  level: CourseLevel;
  course_size_kind_id: string;
  course_size_kind_name: string;
  teacher_id: string;
  teacher_name: string;
  standard_room_id: string | null;
  standard_room_name: string | null;
  status: CourseStatus;
  starts_on: string;
  ends_on: string | null;
  schedules: CourseSchedule[];
};

const toCourse = (row: Row): Course => ({
  id: row.id,
  code: row.code,
  languageId: row.language_id,
  languageName: row.language_name,
  level: row.level,
  courseSizeKindId: row.course_size_kind_id,
  courseSizeKindName: row.course_size_kind_name,
  teacherId: row.teacher_id,
  teacherName: row.teacher_name,
  standardRoomId: row.standard_room_id,
  standardRoomName: row.standard_room_name,
  status: row.status,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  schedules: row.schedules,
});

export type CourseListFilter = {
  includeInactive?: boolean;
  teacherId?: string;
  languageId?: string;
};

export async function listCourses(sql: Sql, filter: CourseListFilter = {}): Promise<Course[]> {
  const includeInactive = filter.includeInactive === true;
  const rows = await sql<Row[]>`
    SELECT courses.id, courses.code, courses.language_id, languages.name AS language_name, courses.level,
           courses.course_size_kind_id, kinds.name AS course_size_kind_name,
           courses.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
           courses.standard_room_id, rooms.name AS standard_room_name, courses.status,
           to_char(courses.starts_on, 'YYYY-MM-DD') AS starts_on,
           to_char(courses.ends_on, 'YYYY-MM-DD') AS ends_on,
           COALESCE((
             SELECT json_agg(json_build_object('id', cs.id, 'weekday', cs.weekday, 'startTime', to_char(cs.start_time, 'HH24:MI'), 'durationMinutes', cs.duration_minutes) ORDER BY cs.weekday, cs.start_time)
             FROM course_schedules cs WHERE cs.course_id = courses.id
           ), '[]') AS schedules
    FROM courses
    JOIN languages ON languages.id = courses.language_id
    JOIN course_size_kinds kinds ON kinds.id = courses.course_size_kind_id
    JOIN users teacher ON teacher.id = courses.teacher_id
    LEFT JOIN rooms ON rooms.id = courses.standard_room_id
    WHERE (courses.status <> 'cancelled' OR ${includeInactive})
      AND (${filter.teacherId ?? null}::uuid IS NULL OR courses.teacher_id = ${filter.teacherId ?? null})
      AND (${filter.languageId ?? null}::uuid IS NULL OR courses.language_id = ${filter.languageId ?? null})
    ORDER BY languages.sort_order, courses.level, courses.code
  `;
  return rows.map(toCourse);
}

export async function getCourse(sql: Sql, id: string): Promise<Course | null> {
  const [row] = await sql<Row[]>`
    SELECT courses.id, courses.code, courses.language_id, languages.name AS language_name, courses.level,
           courses.course_size_kind_id, kinds.name AS course_size_kind_name,
           courses.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
           courses.standard_room_id, rooms.name AS standard_room_name, courses.status,
           to_char(courses.starts_on, 'YYYY-MM-DD') AS starts_on,
           to_char(courses.ends_on, 'YYYY-MM-DD') AS ends_on,
           COALESCE((
             SELECT json_agg(json_build_object('id', cs.id, 'weekday', cs.weekday, 'startTime', to_char(cs.start_time, 'HH24:MI'), 'durationMinutes', cs.duration_minutes) ORDER BY cs.weekday, cs.start_time)
             FROM course_schedules cs WHERE cs.course_id = courses.id
           ), '[]') AS schedules
    FROM courses
    JOIN languages ON languages.id = courses.language_id
    JOIN course_size_kinds kinds ON kinds.id = courses.course_size_kind_id
    JOIN users teacher ON teacher.id = courses.teacher_id
    LEFT JOIN rooms ON rooms.id = courses.standard_room_id
    WHERE courses.id = ${id}
  `;
  return row ? toCourse(row) : null;
}

export async function codeExists(sql: Sql, code: string, excludeId?: string): Promise<boolean> {
  const [row] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM courses WHERE code = ${code} AND (${excludeId ?? null}::uuid IS NULL OR id <> ${excludeId ?? null})
  `;
  return (row?.count ?? 0) > 0;
}

export type CourseInput = {
  code: string;
  languageId: string;
  level: CourseLevel;
  courseSizeKindId: string;
  teacherId: string;
  standardRoomId: string | null;
  status: CourseStatus;
  startsOn: string;
  endsOn: string | null;
};

export async function insertCourse(sql: Sql, input: CourseInput): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO courses (code, language_id, level, course_size_kind_id, teacher_id, standard_room_id, status, starts_on, ends_on)
    VALUES (${input.code}, ${input.languageId}, ${input.level}, ${input.courseSizeKindId}, ${input.teacherId}, ${input.standardRoomId}, ${input.status}, ${input.startsOn}, ${input.endsOn})
    RETURNING id
  `;
  return row.id;
}

export type CoursePatch = Partial<CourseInput> & { archived?: boolean };

export async function updateCourse(sql: Sql, id: string, patch: CoursePatch): Promise<void> {
  const has = (key: keyof CoursePatch) => Object.prototype.hasOwnProperty.call(patch, key);
  await sql`
    UPDATE courses SET
      code = CASE WHEN ${has("code")} THEN ${patch.code ?? null} ELSE code END,
      language_id = CASE WHEN ${has("languageId")} THEN ${patch.languageId ?? null} ELSE language_id END,
      level = CASE WHEN ${has("level")} THEN ${patch.level ?? null} ELSE level END,
      course_size_kind_id = CASE WHEN ${has("courseSizeKindId")} THEN ${patch.courseSizeKindId ?? null} ELSE course_size_kind_id END,
      teacher_id = CASE WHEN ${has("teacherId")} THEN ${patch.teacherId ?? null} ELSE teacher_id END,
      standard_room_id = CASE WHEN ${has("standardRoomId")} THEN ${patch.standardRoomId ?? null} ELSE standard_room_id END,
      status = CASE WHEN ${has("status")} THEN ${patch.status ?? null} ELSE status END,
      starts_on = CASE WHEN ${has("startsOn")} THEN ${patch.startsOn ?? null} ELSE starts_on END,
      ends_on = CASE WHEN ${has("endsOn")} THEN ${patch.endsOn ?? null} ELSE ends_on END,
      archived_at = CASE WHEN ${has("archived")} THEN ${patch.archived ? new Date().toISOString() : null}::timestamptz ELSE archived_at END
    WHERE id = ${id}
  `;
}

export async function replaceSchedules(sql: Sql, courseId: string, schedules: CourseSchedule[]): Promise<void> {
  await sql`DELETE FROM course_schedules WHERE course_id = ${courseId}`;
  for (const schedule of schedules) {
    await sql`
      INSERT INTO course_schedules (course_id, weekday, start_time, duration_minutes)
      VALUES (${courseId}, ${schedule.weekday}, ${schedule.startTime}, ${schedule.durationMinutes})
    `;
  }
}

export async function recordCodeChange(
  sql: Sql,
  courseId: string,
  oldCode: string,
  newCode: string,
  actorId: string | null,
): Promise<void> {
  await sql`
    INSERT INTO course_code_history (course_id, old_code, new_code, changed_by)
    VALUES (${courseId}, ${oldCode}, ${newCode}, ${actorId})
  `;
}
