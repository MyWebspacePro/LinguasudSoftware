-- Grundstammdaten für Kurse (idempotent, vom Büro erweiterbar).

INSERT INTO languages (code, name, sort_order) VALUES
  ('DE', 'Deutsch', 1),
  ('EN', 'Englisch', 2),
  ('FR', 'Französisch', 3),
  ('IT', 'Italienisch', 4),
  ('ES', 'Spanisch', 5),
  ('XX', 'Andere', 99)
ON CONFLICT (name) DO NOTHING;

INSERT INTO course_size_kinds (code, name, min_participants, max_participants, standard_duration_minutes, is_online, sort_order) VALUES
  ('PRV', 'Privat', 1, 1, 60, false, 1),
  ('DUO', 'Duo', 2, 2, 60, false, 2),
  ('KL3', 'Kleingruppe 3', 3, 3, 90, false, 3),
  ('KL4', 'Kleingruppe 4', 4, 4, 90, false, 4),
  ('GRU', 'Gruppe 6', 5, 6, 90, false, 5),
  ('ONL', 'Online privat', 1, 1, 60, true, 6)
ON CONFLICT (name) DO NOTHING;
