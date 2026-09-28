CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  teacher_code TEXT UNIQUE,
  phone TEXT,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  specializations TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  rate_per_lesson NUMERIC(10,2),
  currency CHAR(3) NOT NULL DEFAULT 'CHF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
