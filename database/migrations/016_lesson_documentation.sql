-- A concrete lesson keeps its own teaching documentation. These fields stay
-- on the lesson (not on the course), so content, homework and notes remain
-- traceable even when the weekly schedule or course level changes.
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS lesson_content TEXT,
  ADD COLUMN IF NOT EXISTS homework TEXT,
  ADD COLUMN IF NOT EXISTS teacher_notes TEXT;

CREATE INDEX IF NOT EXISTS lessons_documented_idx
  ON lessons(course_id, starts_at DESC)
  WHERE lesson_content IS NOT NULL OR homework IS NOT NULL OR teacher_notes IS NOT NULL;
