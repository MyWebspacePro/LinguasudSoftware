ALTER TABLE participant_profiles
  ADD COLUMN IF NOT EXISTS salutation TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE teacher_profiles
  ADD COLUMN IF NOT EXISTS salutation TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT;

CREATE TABLE IF NOT EXISTS person_notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_notes_user_idx ON person_notes(user_id, created_at DESC);

-- Keep the existing single-name records usable while the structured fields
-- are introduced. The split is only a fallback for legacy rows.
UPDATE participant_profiles p
SET first_name = split_part(u.name, ' ', 1),
    last_name = CASE WHEN strpos(u.name, ' ') > 0 THEN NULLIF(substr(u.name, strpos(u.name, ' ') + 1), '') ELSE NULL END
FROM users u
WHERE p.user_id = u.id AND p.first_name IS NULL;

UPDATE teacher_profiles p
SET first_name = split_part(u.name, ' ', 1),
    last_name = CASE WHEN strpos(u.name, ' ') > 0 THEN NULLIF(substr(u.name, strpos(u.name, ' ') + 1), '') ELSE NULL END
FROM users u
WHERE p.user_id = u.id AND p.first_name IS NULL;

INSERT INTO person_notes (id, user_id, body, created_at)
SELECT md5('participant-note:' || p.user_id::text)::uuid, p.user_id, p.notes, p.updated_at
FROM participant_profiles p
WHERE NULLIF(trim(p.notes), '') IS NOT NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO person_notes (id, user_id, body, created_at)
SELECT md5('teacher-note:' || p.user_id::text)::uuid, p.user_id, p.notes, p.updated_at
FROM teacher_profiles p
WHERE NULLIF(trim(p.notes), '') IS NOT NULL
ON CONFLICT (id) DO NOTHING;
