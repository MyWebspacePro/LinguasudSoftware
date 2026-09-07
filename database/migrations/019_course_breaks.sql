-- Planned interruptions (for example school holidays or teacher leave) belong
-- to the course and cancel only the affected concrete future lessons.
CREATE TABLE IF NOT EXISTS course_breaks (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS course_breaks_course_dates_idx
  ON course_breaks(course_id, starts_on, ends_on);
