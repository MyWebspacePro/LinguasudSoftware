CREATE TABLE IF NOT EXISTS change_history (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS change_history_entity_idx ON change_history(entity_type, entity_id, occurred_at DESC);
