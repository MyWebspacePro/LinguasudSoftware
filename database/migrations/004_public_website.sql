-- Public forms are throttled without storing visitor IP addresses in plain text.
CREATE TABLE IF NOT EXISTS public_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT NOT NULL CHECK (form_type IN ('inquiry', 'placement')),
  visitor_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_submissions_recent_idx
  ON public_submissions(form_type, visitor_hash, created_at DESC);

-- Questions are maintained internally. Never include correct_option in a public response.
CREATE TABLE IF NOT EXISTS placement_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('A1', 'A2', 'B1', 'B2')),
  prompt TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option SMALLINT NOT NULL CHECK (correct_option BETWEEN 0 AND 2),
  sort_order SMALLINT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO placement_questions (level, prompt, options, correct_option, sort_order) VALUES
  ('A1', 'Wie heisst du? – Ich ___ Anna.', '["bin", "bist", "ist"]', 0, 1),
  ('A1', 'Das ist ___ Buch.', '["eine", "ein", "einen"]', 1, 2),
  ('A2', 'Gestern ___ wir im Kino.', '["waren", "sind", "haben"]', 0, 3),
  ('A2', 'Ich freue mich ___ das Wochenende.', '["über", "auf", "mit"]', 1, 4),
  ('B1', 'Wenn ich mehr Zeit hätte, ___ ich öfter lesen.', '["werde", "würde", "habe"]', 1, 5),
  ('B1', 'Das ist der Mann, ___ ich gestern getroffen habe.', '["dem", "den", "der"]', 1, 6),
  ('B2', 'Obwohl es stark regnete, ___ wir spazieren.', '["gingen", "gehen", "gegangen"]', 0, 7),
  ('B2', 'Die Unterlagen müssen bis morgen ___ werden.', '["bearbeiten", "bearbeitet", "bearbeitend"]', 1, 8)
ON CONFLICT (sort_order) DO NOTHING;
