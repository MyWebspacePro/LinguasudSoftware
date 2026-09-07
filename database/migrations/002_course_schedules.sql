CREATE TABLE IF NOT EXISTS course_schedules (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 15 AND 360 AND duration_minutes % 15 = 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, weekday)
);

CREATE INDEX IF NOT EXISTS course_schedules_course_idx ON course_schedules(course_id);
