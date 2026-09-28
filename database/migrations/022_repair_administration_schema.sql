-- Some early installations were created while the administration module was
-- still evolving. This defensive migration repairs such databases even when
-- their migration ledger was populated prematurely. Every operation is
-- additive and idempotent; existing school data is never replaced or deleted.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS starts_on DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE TABLE IF NOT EXISTS course_schedules (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 15 AND 360 AND duration_minutes % 15 = 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, weekday)
);

CREATE TABLE IF NOT EXISTS participant_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  preferred_contact TEXT NOT NULL DEFAULT 'email' CHECK (preferred_contact IN ('email', 'phone', 'postal')),
  notes TEXT,
  email_reminders BOOLEAN NOT NULL DEFAULT false,
  language_preference TEXT,
  salutation TEXT,
  first_name TEXT,
  last_name TEXT,
  gender TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE participant_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS email_reminders BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS language_preference TEXT,
  ADD COLUMN IF NOT EXISTS salutation TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  teacher_code TEXT UNIQUE,
  phone TEXT,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  rate_per_lesson NUMERIC(10,2),
  currency CHAR(3) NOT NULL DEFAULT 'CHF',
  salutation TEXT,
  first_name TEXT,
  last_name TEXT,
  gender TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE teacher_profiles
  ADD COLUMN IF NOT EXISTS teacher_code TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rate_per_lesson NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'CHF',
  ADD COLUMN IF NOT EXISTS salutation TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS purchased_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'CHF',
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS case_reference TEXT,
  ADD COLUMN IF NOT EXISTS approved_lessons SMALLINT,
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS tariff NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS invoice_recipient TEXT;

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

CREATE TABLE IF NOT EXISTS teacher_teaching_levels (
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, language, level)
);

CREATE TABLE IF NOT EXISTS person_notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS course_breaks (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS lesson_content TEXT,
  ADD COLUMN IF NOT EXISTS homework TEXT,
  ADD COLUMN IF NOT EXISTS teacher_notes TEXT;

CREATE INDEX IF NOT EXISTS course_schedules_course_idx ON course_schedules(course_id);
CREATE INDEX IF NOT EXISTS change_history_entity_idx ON change_history(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS teacher_teaching_levels_language_idx ON teacher_teaching_levels(language, level);
CREATE INDEX IF NOT EXISTS person_notes_user_idx ON person_notes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS office_tasks_status_created_idx ON office_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS enrollment_pauses_enrollment_idx ON enrollment_pauses(enrollment_id, starts_on);
CREATE INDEX IF NOT EXISTS course_breaks_course_dates_idx ON course_breaks(course_id, starts_on, ends_on);
