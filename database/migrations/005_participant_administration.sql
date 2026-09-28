CREATE TABLE IF NOT EXISTS participant_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  date_of_birth DATE,
  preferred_contact TEXT NOT NULL DEFAULT 'email' CHECK (preferred_contact IN ('email', 'phone', 'postal')),
  emergency_name TEXT,
  emergency_phone TEXT,
  notes TEXT,
  email_reminders BOOLEAN NOT NULL DEFAULT false,
  language_preference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'open' CHECK (payment_status IN ('open', 'partially_paid', 'paid', 'overdue'));
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS purchased_amount NUMERIC(10,2);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'CHF';
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS payer_name TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS case_reference TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS approved_lessons SMALLINT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(10,2);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS valid_from DATE;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS tariff NUMERIC(10,2);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS invoice_recipient TEXT;
