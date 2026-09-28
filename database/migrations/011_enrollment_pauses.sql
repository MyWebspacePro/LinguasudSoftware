CREATE TABLE IF NOT EXISTS enrollment_pauses (
  id UUID PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS enrollment_pauses_enrollment_idx ON enrollment_pauses(enrollment_id, starts_on);
