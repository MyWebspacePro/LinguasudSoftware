CREATE TABLE IF NOT EXISTS office_tasks (
  id UUID PRIMARY KEY,
  task_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  source_history_id UUID UNIQUE REFERENCES change_history(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS office_tasks_status_created_idx ON office_tasks(status, created_at);

-- Preserve earlier teacher level changes as open tasks. Using the history id
-- makes this backfill idempotent and keeps the task tied to the original event.
INSERT INTO office_tasks
  (id, task_type, entity_type, entity_id, title, description, source_history_id, created_by, created_at)
SELECT
  h.id,
  'course_level_changed',
  'course',
  h.entity_id,
  'Kursniveau prüfen',
  h.summary || '. Kursbezeichnung/Kurskennung im Büro prüfen.',
  h.id,
  h.actor_id,
  h.occurred_at
FROM change_history h
WHERE h.entity_type = 'course'
  AND h.event_type = 'level_changed'
ON CONFLICT (source_history_id) DO NOTHING;
