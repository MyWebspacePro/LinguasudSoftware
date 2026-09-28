-- Remove the exact duplicate left by the former planner write path before
-- enforcing the rule in PostgreSQL as well as in the application service.
DELETE FROM lessons duplicate
USING lessons existing
WHERE duplicate.id > existing.id
  AND duplicate.course_id = existing.course_id
  AND duplicate.room_id IS NOT DISTINCT FROM existing.room_id
  AND duplicate.teacher_id = existing.teacher_id
  AND duplicate.starts_at = existing.starts_at
  AND duplicate.duration_minutes = existing.duration_minutes
  AND duplicate.status = existing.status;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE lessons
  ADD CONSTRAINT lessons_room_time_exclusion
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(starts_at, starts_at + duration_minutes * interval '1 minute', '[)') WITH &&
  )
  WHERE (room_id IS NOT NULL AND status <> 'cancelled');

ALTER TABLE lessons
  ADD CONSTRAINT lessons_teacher_time_exclusion
  EXCLUDE USING gist (
    teacher_id WITH =,
    tstzrange(starts_at, starts_at + duration_minutes * interval '1 minute', '[)') WITH &&
  )
  WHERE (status <> 'cancelled');
