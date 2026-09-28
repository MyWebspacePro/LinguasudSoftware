-- Linguasud Verwaltungssoftware – konsolidierte Schema-Baseline.
-- Ersetzt die frühere, widersprüchliche Migrationshistorie (001–023).
-- Voraussetzung: leere Datenbank (es existieren keine Produktivdaten).

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Identität, Rollen, Sitzungen
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salutation TEXT CHECK (salutation IN ('herr', 'frau', 'divers')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone1 TEXT,
  phone2 TEXT,
  whatsapp_ok BOOLEAN NOT NULL DEFAULT false,
  signal_ok BOOLEAN NOT NULL DEFAULT false,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  address_extra TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('office', 'teacher', 'participant', 'finance', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles(role);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

-- ---------------------------------------------------------------------------
-- Standorte & Räume
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  sort_order SMALLINT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floor TEXT,
  capacity SMALLINT NOT NULL CHECK (capacity > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (location_id, name)
);

CREATE INDEX IF NOT EXISTS rooms_location_idx ON rooms(location_id, active);

-- ---------------------------------------------------------------------------
-- Organisationen / Kostenträger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('company', 'authority', 'parent', 'other')),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  address_extra TEXT,
  customer_number TEXT,
  invoice_recipient TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_kind_idx ON organizations(kind, active);

-- ---------------------------------------------------------------------------
-- Lehrpersonen & Teilnehmende
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS teacher_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  birth_date DATE,
  mother_tongue TEXT,
  start_level TEXT CHECK (start_level IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_qualifications (
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, language, level)
);

CREATE TABLE IF NOT EXISTS participant_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  marketing_source TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Kurs-Stammdaten
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_size_kinds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  min_participants SMALLINT NOT NULL CHECK (min_participants > 0),
  max_participants SMALLINT NOT NULL,
  standard_duration_minutes SMALLINT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (max_participants >= min_participants)
);

-- Honorarsätze je Lehrperson und Kursart (Gruppengrösse)
CREATE TABLE IF NOT EXISTS teacher_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_size_kind_id UUID NOT NULL REFERENCES course_size_kinds(id) ON DELETE CASCADE,
  rate_chf NUMERIC(10, 2) NOT NULL CHECK (rate_chf >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, course_size_kind_id)
);

-- Tarif-Matrix (konfigurierbar, jährlich pflegbar)
CREATE TABLE IF NOT EXISTS price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS price_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  course_size_kind_id UUID NOT NULL REFERENCES course_size_kinds(id) ON DELETE CASCADE,
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes > 0),
  tariff TEXT NOT NULL CHECK (tariff IN ('normal', 'low')),
  min_lessons SMALLINT NOT NULL DEFAULT 1 CHECK (min_lessons > 0),
  package_lessons SMALLINT,
  price_chf NUMERIC(10, 2) NOT NULL CHECK (price_chf >= 0),
  UNIQUE (price_list_id, course_size_kind_id, duration_minutes, tariff, min_lessons)
);

-- ---------------------------------------------------------------------------
-- Kurse, Wochenplan, Unterbrüche
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  language_id UUID NOT NULL REFERENCES languages(id),
  level TEXT NOT NULL CHECK (level IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  course_size_kind_id UUID NOT NULL REFERENCES course_size_kinds(id),
  teacher_id UUID NOT NULL REFERENCES users(id),
  standard_room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE, -- NULL = fortlaufend
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS courses_teacher_idx ON courses(teacher_id, status);
CREATE INDEX IF NOT EXISTS courses_language_level_idx ON courses(language_id, level);

CREATE TABLE IF NOT EXISTS course_code_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  old_code TEXT NOT NULL,
  new_code TEXT NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS course_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 15 AND 360 AND duration_minutes % 15 = 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, weekday, start_time)
);

CREATE INDEX IF NOT EXISTS course_schedules_course_idx ON course_schedules(course_id);

CREATE TABLE IF NOT EXISTS course_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS course_breaks_course_idx ON course_breaks(course_id, starts_on, ends_on);

-- ---------------------------------------------------------------------------
-- Lektionen
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes > 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  is_provisional BOOLEAN NOT NULL DEFAULT false,
  cancellation_reason TEXT,
  online_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lessons_starts_idx ON lessons(starts_at);
CREATE INDEX IF NOT EXISTS lessons_room_time_idx ON lessons(room_id, starts_at);
CREATE INDEX IF NOT EXISTS lessons_teacher_time_idx ON lessons(teacher_id, starts_at);
CREATE INDEX IF NOT EXISTS lessons_course_idx ON lessons(course_id);

-- ---------------------------------------------------------------------------
-- Anmeldungen, Pausen, Guthaben
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'trial', 'active', 'inactive')),
  billing_type TEXT NOT NULL DEFAULT 'private' CHECK (billing_type IN ('private', 'company', 'authority')),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  agreed_price_chf NUMERIC(10, 2),
  agreed_lessons SMALLINT,
  started_on DATE,
  ended_on DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, participant_id)
);

CREATE INDEX IF NOT EXISTS enrollments_participant_idx ON enrollments(participant_id, active);
CREATE INDEX IF NOT EXISTS enrollments_course_idx ON enrollments(course_id, active);

CREATE TABLE IF NOT EXISTS enrollment_pauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE,
  reason TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  delta SMALLINT NOT NULL,
  reason TEXT NOT NULL,
  reference_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_transactions_enrollment_idx ON credit_transactions(enrollment_id, created_at);

-- ---------------------------------------------------------------------------
-- Anwesenheit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'excused', 'unexcused')),
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, enrollment_id)
);

CREATE INDEX IF NOT EXISTS attendance_enrollment_idx ON attendance(enrollment_id);

-- ---------------------------------------------------------------------------
-- Notizen
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS person_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_notes_user_idx ON person_notes(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Historie, Audit, Sicherheitsereignisse, Einwilligungen
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE INDEX IF NOT EXISTS change_history_actor_idx ON change_history(actor_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_type_idx ON security_events(event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('agb', 'privacy', 'photo', 'whatsapp', 'signal')),
  granted BOOLEAN NOT NULL,
  method TEXT,
  evidence TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consents_user_idx ON consents(user_id, kind);

-- ---------------------------------------------------------------------------
-- Einstufungstest (öffentlich)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS placement_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL,
  result_level TEXT CHECK (result_level IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  participant_id UUID REFERENCES users(id) ON DELETE SET NULL,
  answers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Raumvermietung
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS room_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  customer_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('one_time', 'series')),
  starts_on DATE NOT NULL,
  ends_on DATE,
  weekday SMALLINT CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME,
  end_time TIME,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS room_rentals_room_idx ON room_rentals(room_id, starts_on);

-- ---------------------------------------------------------------------------
-- Büro-Dienstplan & Abwesenheiten
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS office_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS office_shifts_user_idx ON office_shifts(user_id, starts_at);

CREATE TABLE IF NOT EXISTS staff_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected')),
  kind TEXT,
  note TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS teacher_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  action TEXT NOT NULL DEFAULT 'pause' CHECK (action IN ('pause', 'takeover')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected')),
  note TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

-- ---------------------------------------------------------------------------
-- Aufgaben (intern)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  due_on DATE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status, due_on);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx ON tasks(assigned_to, status);

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS task_links_entity_idx ON task_links(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Benachrichtigungen & ausgehende Nachrichten
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity_type TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS outbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbound_messages_queue_idx ON outbound_messages(status, scheduled_at);

-- ---------------------------------------------------------------------------
-- Rechnungen (bexio-Synchronisation)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('package', 'monthly', 'other')),
  bexio_invoice_id TEXT UNIQUE,
  number TEXT,
  amount_chf NUMERIC(10, 2) NOT NULL CHECK (amount_chf >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  issued_on DATE,
  due_on DATE,
  paid_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_org_idx ON invoices(organization_id, status);

-- ---------------------------------------------------------------------------
-- Öffentliche Website (CMS & Anfragen)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'de' CHECK (locale IN ('de', 'en')),
  title TEXT NOT NULL,
  body TEXT,
  seo_title TEXT,
  seo_description TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, locale)
);

CREATE TABLE IF NOT EXISTS inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salutation TEXT CHECK (salutation IN ('herr', 'frau', 'divers')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  language TEXT,
  course_form TEXT,
  self_assessment TEXT,
  goal TEXT,
  message TEXT,
  handled BOOLEAN NOT NULL DEFAULT false,
  participant_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquiries_handled_idx ON inquiries(handled, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at-Trigger
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'users', 'locations', 'rooms', 'organizations', 'teacher_profiles',
    'participant_profiles', 'languages', 'course_size_kinds', 'teacher_rates',
    'price_lists', 'courses', 'course_schedules', 'lessons', 'enrollments',
    'attendance', 'room_rentals', 'office_shifts', 'staff_absences',
    'teacher_absences', 'tasks', 'invoices', 'cms_pages'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      tbl
    );
  END LOOP;
END;
$$;
