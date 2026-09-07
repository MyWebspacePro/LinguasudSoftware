"use client";

import { useState } from "react";

import { formatTime } from "@/lib/linguasud-demo";

type RoleWorkspaceProps = {
  role: "teacher" | "participant";
  onNotice: (message: string) => void;
};

type AttendanceStatus = "present" | "excused" | "unexcused" | "cancelled_short_notice" | "trial" | "online";

type LessonForAttendance = {
  id: string;
  code: string;
  language: string;
  level: string;
  starts_at: string;
  duration_minutes: number;
  room_name: string;
  location_name: string;
  status: "scheduled" | "completed" | "cancelled";
};

type AttendanceEntry = {
  enrollment_id: string;
  participant_name: string;
  status: AttendanceStatus | null;
};

const attendanceOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "present", label: "Anwesend" },
  { value: "excused", label: "Entschuldigt" },
  { value: "unexcused", label: "Unentschuldigt" },
  { value: "cancelled_short_notice", label: "Kurzfristig abgesagt" },
  { value: "online", label: "Online teilgenommen" },
  { value: "trial", label: "Probelektion" },
];

function localDateForApi(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function apiError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export function RoleWorkspace({ role, onNotice }: RoleWorkspaceProps) {
  return role === "teacher" ? <TeacherWorkspace onNotice={onNotice} /> : <ParticipantWorkspace onNotice={onNotice} />;
}

function TeacherWorkspace({ onNotice }: { onNotice: (message: string) => void }) {
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [attendanceLesson, setAttendanceLesson] = useState<LessonForAttendance | null>(null);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [isAttendanceSaving, setIsAttendanceSaving] = useState(false);

  async function openAttendance() {
    setIsAttendanceOpen(true);
    setAttendanceLesson(null);
    setAttendanceEntries([]);
    setAttendance({});
    setAttendanceError(null);
    setIsAttendanceLoading(true);

    try {
      const lessonsResponse = await fetch(`/api/lessons?date=${localDateForApi()}`, { credentials: "same-origin" });
      const lessonsPayload: unknown = await lessonsResponse.json();
      if (!lessonsResponse.ok) throw new Error(apiError(lessonsPayload, "Deine Lektionen konnten nicht geladen werden."));

      const lessons = typeof lessonsPayload === "object" && lessonsPayload !== null && "lessons" in lessonsPayload && Array.isArray(lessonsPayload.lessons)
        ? lessonsPayload.lessons as LessonForAttendance[]
        : [];
      const lesson = lessons.find((item) => item.status === "scheduled");
      if (!lesson) {
        setAttendanceError("Für heute ist keine offene Lektion vorhanden.");
        return;
      }

      const response = await fetch(`/api/attendance?lessonId=${encodeURIComponent(lesson.id)}`, { credentials: "same-origin" });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Die Anwesenheiten konnten nicht geladen werden."));

      const entries = typeof payload === "object" && payload !== null && "attendance" in payload && Array.isArray(payload.attendance)
        ? payload.attendance as AttendanceEntry[]
        : [];
      setAttendanceLesson(lesson);
      setAttendanceEntries(entries);
      setAttendance(Object.fromEntries(entries.map((entry) => [entry.enrollment_id, entry.status ?? "present"])) as Record<string, AttendanceStatus>);
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : "Die Anwesenheiten konnten nicht geladen werden.");
    } finally {
      setIsAttendanceLoading(false);
    }
  }

  async function saveAttendance() {
    if (!attendanceLesson) return;
    setAttendanceError(null);
    setIsAttendanceSaving(true);

    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: attendanceLesson.id,
          entries: attendanceEntries.map((entry) => ({ enrollmentId: entry.enrollment_id, status: attendance[entry.enrollment_id] ?? "present" })),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Die Anwesenheiten konnten nicht gespeichert werden."));

      const absent = Object.values(attendance).filter((status) => status !== "present").length;
      onNotice(`Anwesenheit gespeichert. ${absent} Abwesenheit${absent === 1 ? "" : "en"} wird dem Büro angezeigt.`);
      setIsAttendanceOpen(false);
    } catch (error) {
      setAttendanceError(error instanceof Error ? error.message : "Die Anwesenheiten konnten nicht gespeichert werden.");
    } finally {
      setIsAttendanceSaving(false);
    }
  }

  return <section className="role-workspace" aria-labelledby="teacher-title">
    <div className="role-workspace__intro"><p className="eyebrow">Lehrpersonenbereich</p><h2 id="teacher-title">Guten Abend, Maria.</h2><p>Du siehst nur deine heutigen Lektionen und die dafür nötigen Teilnahmedaten.</p></div>
    <article className="teacher-lesson"><div><span className="status-pill">Heute · 18:00 Uhr</span><h3>Deutsch A2 · Abendkurs</h3><p>Schaffhausen 1 · Raum A1 · 5 Teilnehmende</p></div><button className="primary-button" type="button" onClick={openAttendance}>Anwesenheit erfassen</button></article>
    <div className="teacher-grid"><article><span>Danach</span><h3>Unterrichtsinhalt ergänzen</h3><p>Notiere Ablauf, Hausaufgaben und besondere Vorkommnisse direkt bei der Lektion.</p><button type="button" onClick={() => onNotice("Die Lektionsplanung öffnet sich nach Auswahl der konkreten Lektion.")}>Lektionsplanung öffnen →</button></article><article><span>Kursniveau</span><h3>Aktuell A2</h3><p>Niveauänderungen kannst du für deinen Kurs melden. Die sichtbare Kennung passt anschliessend das Büro an.</p><button type="button" onClick={() => onNotice("Niveauänderung als Meldung ans Büro vorbereitet.")}>Niveauänderung melden →</button></article></div>
    {isAttendanceOpen ? <div className="dialog-backdrop" role="presentation"><section className="attendance-dialog" aria-labelledby="attendance-title" role="dialog" aria-modal="true"><button aria-label="Anwesenheit schliessen" className="dialog-close" onClick={() => setIsAttendanceOpen(false)} type="button">×</button><p className="eyebrow">{attendanceLesson ? `${attendanceLesson.code} · ${new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(new Date(attendanceLesson.starts_at))}` : "Anwesenheit"}</p><h2 id="attendance-title">Anwesenheit</h2><p className="dialog-course">Bitte nach der stattgefundenen Lektion bestätigen.</p>{isAttendanceLoading ? <p aria-live="polite">Anwesenheiten werden geladen …</p> : attendanceError ? <p aria-live="assertive" className="dialog-note">{attendanceError}</p> : <div className="attendance-list">{attendanceEntries.map((entry) => <div key={entry.enrollment_id}><strong>{entry.participant_name}</strong><select aria-label={`${entry.participant_name} Anwesenheit`} value={attendance[entry.enrollment_id] ?? "present"} onChange={(event) => setAttendance((current) => ({ ...current, [entry.enrollment_id]: event.target.value as AttendanceStatus }))}>{attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>)}</div>}<div className="dialog-actions"><button className="quiet-button" disabled={isAttendanceSaving} onClick={() => setIsAttendanceOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isAttendanceLoading || isAttendanceSaving || !attendanceLesson || attendanceEntries.length === 0} onClick={saveAttendance} type="button">{isAttendanceSaving ? "Wird gespeichert …" : "Anwesenheit bestätigen"}</button></div></section></div> : null}
  </section>;
}

function ParticipantWorkspace({ onNotice }: { onNotice: (message: string) => void }) {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const nextLessonTime = 18 * 60;

  return <section className="role-workspace participant-workspace" aria-labelledby="participant-title">
    <div className="role-workspace__intro"><p className="eyebrow">Mein Kurs</p><h2 id="participant-title">Hallo Lea.</h2><p>Hier findest du deine nächsten Termine und wichtige Änderungen.</p></div>
    <article className="next-lesson-card"><div className="next-lesson-card__date"><strong>Mo</strong><span>07</span><small>Sept.</small></div><div><span className="status-pill">Nächste Lektion</span><h3>Deutsch A2 · Abendkurs</h3><p>{formatTime(nextLessonTime)}–19:30 Uhr · Schaffhausen 1 · Raum A1</p><p className="teacher-line">Lehrperson: Maria Keller</p></div></article>
    <div className="participant-grid"><article><span>Benachrichtigungen</span><h3>Erinnerungen</h3><label><input checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} type="checkbox" /> E-Mail vor dem Termin</label><label><input checked={pushEnabled} onChange={(event) => setPushEnabled(event.target.checked)} type="checkbox" /> Push bei Raum- oder Zeitänderung</label><button type="button" onClick={() => onNotice("Benachrichtigungseinstellungen gespeichert.")}>Einstellungen speichern →</button></article><article><span>Wichtig</span><h3>Änderungen sofort sichtbar</h3><p>Bei einer Absage oder Raumänderung erscheint die aktuelle Information hier. Zusätzlich wird die gewählte Erinnerung ausgelöst.</p><button type="button" onClick={() => onNotice("Aktuell gibt es keine Änderungen an deinem Kurs.")}>Aktuellen Status prüfen →</button></article></div>
  </section>;
}
