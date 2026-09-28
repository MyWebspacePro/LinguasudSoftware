-- Phase 6: Lohnauszahlungen (Honorar) und Rechnungsperiode.

CREATE TABLE IF NOT EXISTS teacher_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  amount_chf NUMERIC(10, 2) NOT NULL DEFAULT 0,
  lessons_count INTEGER NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, period)
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS period TEXT;

DROP TRIGGER IF EXISTS set_updated_at ON teacher_payroll;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON teacher_payroll
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
