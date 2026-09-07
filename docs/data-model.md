# Datenmodell und Querverweise

Die Administration verwendet die UUID des jeweiligen Datensatzes als stabile Referenz. Anzeigenamen, Kurskennungen und Raumbezeichnungen werden nie als Beziehungen gespeichert.

## Zentrale Beziehungen

- `users` ist die Identität für Büro, Lehrpersonen und Teilnehmende. Die Rolle steht in `users.role`.
- `teacher_profiles.user_id` und `participant_profiles.user_id` erweitern die jeweilige Identität um Stammdaten.
- `courses.teacher_id` verweist auf die Lehrperson und `courses.standard_room_id` auf den Standardraum.
- `course_schedules.course_id` beschreibt die wöchentlichen Termine eines Kurses. Je Wochentag wird nur die Startzeit gepflegt; die Dauer stammt verbindlich aus `courses.duration_minutes`.
- `lessons.course_id`, `lessons.room_id` und `lessons.teacher_id` verknüpfen jede konkrete Lektion mit Kurs, Raum und (gegebenenfalls abweichender) Lehrperson. Die Dauer bleibt durch Kurs beziehungsweise Termin verbindlich vorgegeben; die konkrete Lektion trägt Unterrichtsinhalt, Hausaufgaben und interne Lehrpersonennotizen.
- `enrollments.course_id` und `enrollments.participant_id` verknüpfen Kurse und Teilnehmende.
- `attendance.lesson_id` und `attendance.enrollment_id` verknüpfen Anwesenheiten mit genau einer Lektion und Teilnahme.
- `enrollment_pauses.enrollment_id`, `person_notes.user_id` und `change_history.actor_id` bewahren Pausen, Notizen und die Änderungshistorie.
- Die Raumplanung prüft die Raumkapazität und Lehrpersonenkollisionen; die 15-Minuten-Raumpufferwarnung bleibt eine bestätigbare Warnung. Kurse am Standort Winterthur dürfen nicht in ein anderes Gebäude verschoben werden.

## Aggregate-APIs

Die Listen- und Detailrouten liefern neben den flachen IDs auch strukturierte Referenzobjekte. Für Detailansichten stehen folgende vollständige Aggregate zur Verfügung:

| Datensatz | Route | Enthält |
| --- | --- | --- |
| Kurs | `/api/courses/:courseId` | Lehrperson, Standardraum/Standort, Wochenplan, Lektionen, Teilnahmen, Anwesenheiten, Qualifikationen, Historie |
| Raum | `/api/rooms/:roomId` | Standort, Standardkurse, Wochenpläne, Lektionen, Lehrpersonen |
| Standort | `/api/locations/:locationId` | Räume mit Kurs- und Lektionsreferenzen |
| Lehrperson | `/api/teachers/:teacherId` | Identität, Sprach-/Niveaubereiche, Kurse, Lektionen, Notizen, Historie |
| Teilnehmende | `/api/participants/:participantId` | Identität, Kurse/Teilnahmen, Anwesenheitsübersicht, Lektionen, Pausen, Notizen, Historie |
| Teilnahme | `/api/enrollments/:enrollmentId` | Teilnehmer, Kurs, Lektionen, Anwesenheiten, Pausen, Abrechnung, Historie |
| Lektion | `/api/lessons/:lessonId` | Kurs, Raum, Lehrperson, Teilnehmerliste und Anwesenheitsreferenzen |

Stammdatenänderungen erfolgen über `PATCH /api/rooms/:roomId`, `PATCH /api/locations/:locationId` und `PATCH /api/courses/:courseId` (Kursstatus, Kurskennung, Niveau und Dauer). Eine geänderte Kursdauer wird nach Konfliktprüfung auf Wochenplan und zukünftige geplante Lektionen übertragen. Anlage, Änderungen, Verschiebungen, Abmeldungen und Statuswechsel werden in `change_history` protokolliert. Die Raumverwaltung kann mit `GET /api/rooms?includeInactive=true` auch deaktivierte Räume für eine Reaktivierung laden; der Planer verwendet weiterhin nur aktive Räume.

Die Migrationen `013_person_identity_and_notes.sql` bis `017_normalize_course_duration.sql` werden beim Start des Containers automatisch angewendet.
