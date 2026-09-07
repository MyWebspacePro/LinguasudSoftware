-- Stable relational lookup paths used by all administration modules.
CREATE INDEX IF NOT EXISTS courses_teacher_idx ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS courses_standard_room_idx ON courses(standard_room_id);
CREATE INDEX IF NOT EXISTS rooms_location_idx ON rooms(location_id);
CREATE INDEX IF NOT EXISTS course_schedules_course_weekday_idx ON course_schedules(course_id, weekday, start_time);
CREATE INDEX IF NOT EXISTS lessons_course_idx ON lessons(course_id, starts_at);
CREATE INDEX IF NOT EXISTS lessons_teacher_idx ON lessons(teacher_id, starts_at);
CREATE INDEX IF NOT EXISTS lessons_room_idx ON lessons(room_id, starts_at);
CREATE INDEX IF NOT EXISTS enrollments_course_idx ON enrollments(course_id, active);
CREATE INDEX IF NOT EXISTS enrollments_participant_all_idx ON enrollments(participant_id, active);
CREATE INDEX IF NOT EXISTS attendance_lesson_idx ON attendance(lesson_id);
CREATE INDEX IF NOT EXISTS attendance_enrollment_idx ON attendance(enrollment_id);
CREATE INDEX IF NOT EXISTS office_tasks_entity_idx ON office_tasks(entity_type, entity_id, status, created_at DESC);
