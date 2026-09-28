-- Clearly marked, synthetic records so the production administration opens with a usable example.

INSERT INTO locations (id, name, address, sort_order) VALUES
  ('10000000-0000-4000-8000-000000000001', 'DEMO · Schaffhausen', 'Musterstrasse 1, 8200 Schaffhausen', 1),
  ('10000000-0000-4000-8000-000000000002', 'DEMO · Winterthur', 'Beispielweg 1, 8400 Winterthur', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, location_id, name, floor, capacity) VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'DEMO Zimmer 1', 'EG', 8),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'DEMO Zimmer 2', '1. OG', 4),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'DEMO Zimmer 1', 'EG', 8),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'DEMO Zimmer 2', '1. OG', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password_hash, first_name, last_name, active) VALUES
  ('30000000-0000-4000-8000-000000000001', 'demo.lea@example.invalid', 'DEMO_DISABLED', 'Lea DEMO', 'Muster', true),
  ('30000000-0000-4000-8000-000000000002', 'demo.jonas@example.invalid', 'DEMO_DISABLED', 'Jonas DEMO', 'Beispiel', true),
  ('30000000-0000-4000-8000-000000000003', 'demo.sara@example.invalid', 'DEMO_DISABLED', 'Sara DEMO', 'Test', true),
  ('30000000-0000-4000-8000-000000000004', 'demo.office@example.invalid', 'DEMO_DISABLED', 'Nina DEMO', 'Büro', true),
  ('30000000-0000-4000-8000-000000000101', 'demo.anna@example.invalid', 'DEMO_DISABLED', 'Anna DEMO', 'Muster', true),
  ('30000000-0000-4000-8000-000000000102', 'demo.luca@example.invalid', 'DEMO_DISABLED', 'Luca DEMO', 'Beispiel', true),
  ('30000000-0000-4000-8000-000000000103', 'demo.sofia@example.invalid', 'DEMO_DISABLED', 'Sofia DEMO', 'Test', true),
  ('30000000-0000-4000-8000-000000000104', 'demo.noah@example.invalid', 'DEMO_DISABLED', 'Noah DEMO', 'Muster', true),
  ('30000000-0000-4000-8000-000000000105', 'demo.mila@example.invalid', 'DEMO_DISABLED', 'Mila DEMO', 'Beispiel', true),
  ('30000000-0000-4000-8000-000000000106', 'demo.elias@example.invalid', 'DEMO_DISABLED', 'Elias DEMO', 'Test', true),
  ('30000000-0000-4000-8000-000000000107', 'demo.emma@example.invalid', 'DEMO_DISABLED', 'Emma DEMO', 'Muster', true),
  ('30000000-0000-4000-8000-000000000108', 'demo.finn@example.invalid', 'DEMO_DISABLED', 'Finn DEMO', 'Beispiel', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role) VALUES
  ('30000000-0000-4000-8000-000000000001', 'teacher'),
  ('30000000-0000-4000-8000-000000000002', 'teacher'),
  ('30000000-0000-4000-8000-000000000003', 'teacher'),
  ('30000000-0000-4000-8000-000000000004', 'office'),
  ('30000000-0000-4000-8000-000000000101', 'participant'),
  ('30000000-0000-4000-8000-000000000102', 'participant'),
  ('30000000-0000-4000-8000-000000000103', 'participant'),
  ('30000000-0000-4000-8000-000000000104', 'participant'),
  ('30000000-0000-4000-8000-000000000105', 'participant'),
  ('30000000-0000-4000-8000-000000000106', 'participant'),
  ('30000000-0000-4000-8000-000000000107', 'participant'),
  ('30000000-0000-4000-8000-000000000108', 'participant')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO teacher_profiles (user_id, code) VALUES
  ('30000000-0000-4000-8000-000000000001', 'DEMO-LEA'),
  ('30000000-0000-4000-8000-000000000002', 'DEMO-JON'),
  ('30000000-0000-4000-8000-000000000003', 'DEMO-SAR')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO teacher_qualifications (teacher_id, language, level) VALUES
  ('30000000-0000-4000-8000-000000000001', 'Deutsch', 'A1'),
  ('30000000-0000-4000-8000-000000000001', 'Deutsch', 'A2'),
  ('30000000-0000-4000-8000-000000000002', 'Deutsch', 'A2'),
  ('30000000-0000-4000-8000-000000000002', 'Deutsch', 'B1'),
  ('30000000-0000-4000-8000-000000000003', 'Deutsch', 'B1'),
  ('30000000-0000-4000-8000-000000000003', 'Englisch', 'B2')
ON CONFLICT DO NOTHING;

INSERT INTO participant_profiles (user_id, marketing_source) VALUES
  ('30000000-0000-4000-8000-000000000101', 'DEMO'),
  ('30000000-0000-4000-8000-000000000102', 'DEMO'),
  ('30000000-0000-4000-8000-000000000103', 'DEMO'),
  ('30000000-0000-4000-8000-000000000104', 'DEMO'),
  ('30000000-0000-4000-8000-000000000105', 'DEMO'),
  ('30000000-0000-4000-8000-000000000106', 'DEMO'),
  ('30000000-0000-4000-8000-000000000107', 'DEMO'),
  ('30000000-0000-4000-8000-000000000108', 'DEMO')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO courses (id, code, language_id, level, course_size_kind_id, teacher_id, standard_room_id, status, starts_on) VALUES
  ('40000000-0000-4000-8000-000000000001', 'DEMO-DE-A1-GRU-01', (SELECT id FROM languages WHERE code = 'DE'), 'A1', (SELECT id FROM course_size_kinds WHERE code = 'GRU'), '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'active', CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000002', 'DEMO-DE-A2-KL4-02', (SELECT id FROM languages WHERE code = 'DE'), 'A2', (SELECT id FROM course_size_kinds WHERE code = 'KL4'), '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'active', CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000003', 'DEMO-DE-B1-GRU-03', (SELECT id FROM languages WHERE code = 'DE'), 'B1', (SELECT id FROM course_size_kinds WHERE code = 'GRU'), '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', 'active', CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000004', 'DEMO-EN-A2-PRV-04', (SELECT id FROM languages WHERE code = 'EN'), 'A2', (SELECT id FROM course_size_kinds WHERE code = 'PRV'), '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'active', CURRENT_DATE - 14)
ON CONFLICT (id) DO NOTHING;

INSERT INTO course_schedules (course_id, weekday, start_time, duration_minutes) VALUES
  ('40000000-0000-4000-8000-000000000001', 1, '09:00', 90),
  ('40000000-0000-4000-8000-000000000001', 3, '09:00', 90),
  ('40000000-0000-4000-8000-000000000002', 2, '10:30', 90),
  ('40000000-0000-4000-8000-000000000002', 4, '10:30', 90),
  ('40000000-0000-4000-8000-000000000003', 2, '18:30', 90),
  ('40000000-0000-4000-8000-000000000003', 4, '18:30', 90),
  ('40000000-0000-4000-8000-000000000004', 1, '13:00', 60),
  ('40000000-0000-4000-8000-000000000004', 5, '13:00', 60)
ON CONFLICT (course_id, weekday, start_time) DO NOTHING;

INSERT INTO enrollments (course_id, participant_id, status, billing_type, active, started_on) VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000101', 'active', 'private', true, CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000102', 'active', 'private', true, CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000103', 'active', 'private', true, CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000104', 'active', 'private', true, CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000105', 'active', 'private', true, CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000106', 'active', 'private', true, CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000107', 'active', 'private', true, CURRENT_DATE - 14),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000108', 'active', 'private', true, CURRENT_DATE - 14)
ON CONFLICT (course_id, participant_id) DO NOTHING;

-- Create upcoming lessons for the 14-day planner view using the demo course schedules.
INSERT INTO lessons (course_id, room_id, teacher_id, starts_at, duration_minutes, status)
SELECT courses.id, courses.standard_room_id, courses.teacher_id,
       (calendar.day::date + course_schedules.start_time) AT TIME ZONE 'Europe/Zurich',
       course_schedules.duration_minutes, 'scheduled'
FROM courses
JOIN course_schedules ON course_schedules.course_id = courses.id
CROSS JOIN LATERAL generate_series(CURRENT_DATE, CURRENT_DATE + 13, interval '1 day') AS calendar(day)
WHERE courses.code LIKE 'DEMO-%'
  AND EXTRACT(DOW FROM calendar.day)::smallint = course_schedules.weekday
  AND NOT EXISTS (
    SELECT 1 FROM lessons existing
    WHERE existing.course_id = courses.id
      AND existing.starts_at = ((calendar.day::date + course_schedules.start_time) AT TIME ZONE 'Europe/Zurich')
  );

INSERT INTO room_rentals (room_id, title, customer_name, kind, starts_on, ends_on, weekday, start_time, end_time, notes)
VALUES ('20000000-0000-4000-8000-000000000002', 'DEMO Raumnutzung', 'DEMO Organisation', 'series', CURRENT_DATE, CURRENT_DATE + 30, 5, '16:00', '17:00', 'Synthetischer Beispieldatensatz')
ON CONFLICT DO NOTHING;
