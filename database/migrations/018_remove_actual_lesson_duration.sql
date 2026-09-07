-- Defensive cleanup for installations that briefly received migration 016
-- before lesson duration was confirmed as a course-level value.
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_actual_duration_check;
ALTER TABLE lessons DROP COLUMN IF EXISTS actual_duration_minutes;
