import "server-only";

import { db } from "@/server/db";

export type PublicSchedule = { weekday: number; startTime: string; durationMinutes: number };

export type PublicCourse = {
  id: string;
  code: string;
  languageCode: string;
  languageName: string;
  level: string;
  kind: string;
  kindCode: string;
  location: string | null;
  teacherFirstName: string;
  startsOn: string;
  status: "planned" | "active";
  availableSeats: number;
  schedules: PublicSchedule[];
};

type CourseRow = {
  id: string;
  code: string;
  language_code: string;
  language_name: string;
  level: string;
  kind: string;
  kind_code: string;
  location: string | null;
  teacher_first_name: string;
  starts_on: string;
  status: "planned" | "active";
  available_seats: number;
  schedules: PublicSchedule[];
};

/** Only public course fields leave this query; identities and billing stay private. */
export async function listPublicCourses(): Promise<PublicCourse[]> {
  const rows = await db()<CourseRow[]>`
    SELECT courses.id, courses.code, languages.code AS language_code,
           languages.name AS language_name, courses.level, kinds.name AS kind, kinds.code AS kind_code,
           locations.name AS location, teacher.first_name AS teacher_first_name,
           to_char(courses.starts_on, 'YYYY-MM-DD') AS starts_on, courses.status,
           LEAST(kinds.max_participants, COALESCE(rooms.capacity, kinds.max_participants))
             - (SELECT count(*)::int FROM enrollments e
                WHERE e.course_id = courses.id AND e.active = true AND e.status = 'active') AS available_seats,
           (SELECT json_agg(json_build_object(
                     'weekday', schedules.weekday,
                     'startTime', to_char(schedules.start_time, 'HH24:MI'),
                     'durationMinutes', schedules.duration_minutes
                   ) ORDER BY schedules.weekday, schedules.start_time)
            FROM course_schedules schedules WHERE schedules.course_id = courses.id) AS schedules
    FROM courses
    JOIN languages ON languages.id = courses.language_id
    JOIN course_size_kinds kinds ON kinds.id = courses.course_size_kind_id
    JOIN users teacher ON teacher.id = courses.teacher_id
    LEFT JOIN rooms ON rooms.id = courses.standard_room_id
    LEFT JOIN locations ON locations.id = rooms.location_id
    WHERE courses.status IN ('planned', 'active') AND courses.archived_at IS NULL
      AND (courses.ends_on IS NULL OR courses.ends_on >= CURRENT_DATE)
      AND languages.active = true AND kinds.active = true AND kinds.max_participants > 1
      AND teacher.active = true AND (rooms.id IS NULL OR (rooms.active = true AND locations.active = true))
      AND EXISTS (SELECT 1 FROM course_schedules s WHERE s.course_id = courses.id)
      AND LEAST(kinds.max_participants, COALESCE(rooms.capacity, kinds.max_participants)) >
          (SELECT count(*) FROM enrollments e
           WHERE e.course_id = courses.id AND e.active = true AND e.status = 'active')
    ORDER BY languages.sort_order, courses.level, courses.code
  `;

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    languageCode: row.language_code,
    languageName: row.language_name,
    level: row.level,
    kind: row.kind,
    kindCode: row.kind_code,
    location: row.location,
    teacherFirstName: row.teacher_first_name,
    startsOn: row.starts_on,
    status: row.status,
    availableSeats: row.available_seats,
    schedules: row.schedules,
  }));
}
