-- Course duration is the single source of truth. Weekly slots only carry the
-- weekday and start time; future concrete lessons inherit the course duration.
UPDATE course_schedules AS schedule
SET duration_minutes = course.duration_minutes
FROM courses AS course
WHERE course.id = schedule.course_id
  AND schedule.duration_minutes <> course.duration_minutes;

UPDATE lessons AS lesson
SET duration_minutes = course.duration_minutes
FROM courses AS course
WHERE course.id = lesson.course_id
  AND lesson.status = 'scheduled'
  AND lesson.duration_minutes <> course.duration_minutes;
