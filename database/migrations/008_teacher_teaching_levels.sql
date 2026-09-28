CREATE TABLE IF NOT EXISTS teacher_teaching_levels (
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, language, level)
);

CREATE INDEX IF NOT EXISTS teacher_teaching_levels_language_idx
  ON teacher_teaching_levels(language, level);
