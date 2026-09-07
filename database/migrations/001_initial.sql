CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('office', 'teacher', 'participant')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  sort_order SMALLINT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id),
  name TEXT NOT NULL,
  capacity SMALLINT NOT NULL CHECK (capacity > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(location_id, name)
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  level TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES users(id),
  standard_room_id UUID REFERENCES rooms(id),
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes > 0),
  status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id),
  room_id UUID REFERENCES rooms(id),
  teacher_id UUID NOT NULL REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT NOT NULL CHECK (duration_minutes > 0),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id),
  participant_id UUID NOT NULL REFERENCES users(id),
  billing_type TEXT NOT NULL CHECK (billing_type IN ('private', 'authority')),
  credit_lessons SMALLINT,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(course_id, participant_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id),
  status TEXT NOT NULL CHECK (status IN ('present', 'excused', 'unexcused', 'cancelled_short_notice', 'trial', 'online')),
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  UNIQUE(lesson_id, enrollment_id)
);

CREATE INDEX IF NOT EXISTS lessons_starts_at_idx ON lessons(starts_at);
CREATE INDEX IF NOT EXISTS lessons_room_time_idx ON lessons(room_id, starts_at);
CREATE INDEX IF NOT EXISTS enrollments_participant_idx ON enrollments(participant_id) WHERE active;
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
