-- Office accounts are managed separately from participant and teacher records.
-- Deactivation keeps the audit trail intact while blocking future sign-ins.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS users_role_active_idx ON users(role, active, name);
