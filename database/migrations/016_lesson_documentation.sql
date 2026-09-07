-- A concrete lesson keeps its own teaching documentation. These fields stay
-- on the lesson (not on the course), so content, homework and actual duration
-- remain traceable even when the weekly schedule or course level changes.
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS actual_duration_minutes SMALLINT,
  ADD COLUMN IF NOT EXISTS lesson_content TEXT,
  ADD COLUMN IF NOT EXISTS homework TEXT,
  ADD COLUMN IF NOT EXISTS teacher_notes TEXT;

ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_actual_duration_check;
ALTER TABLE lessons
  ADD CONSTRAINT lessons_actual_duration_check
  CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes BETWEEN 1 AND 360);

CREATE INDEX IF NOT EXISTS lessons_documented_idx
  ON lessons(course_id, starts_at DESC)
  WHERE lesson_content IS NOT NULL OR homework IS NOT NULL OR teacher_notes IS NOT NULL;
