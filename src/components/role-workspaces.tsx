"use client";

import { useEffect, useState } from "react";

import { COURSE_LEVELS } from "@/lib/course-levels";

type RoleWorkspaceProps = {
  role: "teacher" | "participant";
  onNotice: (message: string) => void;
  userName?: string;
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

type TeacherCourse = { id: string; code: string; language: string; level: string };

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

export function RoleWorkspace({ role, onNotice, userName = role === "teacher" ? "Lehrperson" : "Teilnehmer:in" }: RoleWorkspaceProps) {
  return role === "teacher" ? <TeacherWorkspace onNotice={onNotice} userName={userName} /> : <ParticipantWorkspace userName={userName} />;
}

function TeacherWorkspace({ onNotice, userName }: { onNotice: (message: string) => void; userName: string }) {
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [attendanceLesson, setAttendanceLesson] = useState<LessonForAttendance | null>(null);
  const [attendanceEntries, setAttendanceEntries] = useState<AttendanceEntry[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [isAttendanceSaving, setIsAttendanceSaving] = useState(false);
  const [isLevelEditorOpen, setIsLevelEditorOpen] = useState(false);
  const [teacherCourses, setTeacherCourses] = useState<TeacherCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [isLevelLoading, setIsLevelLoading] = useState(false);
  const [isLevelSaving, setIsLevelSaving] = useState(false);
  const [levelError, setLevelError] = useState<string | null>(null);

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

  async function openLevelEditor() {
    setIsLevelEditorOpen(true);
    setLevelError(null);
    setIsLevelLoading(true);
    try {
      const response = await fetch("/api/courses", { credentials: "same-origin" });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Deine Kurse konnten nicht geladen werden."));
      const courses = typeof payload === "object" && payload !== null && "courses" in payload && Array.isArray(payload.courses)
        ? payload.courses as TeacherCourse[]
        : [];
      setTeacherCourses(courses);
      setSelectedCourseId(courses[0]?.id ?? "");
      setSelectedLevel(courses[0]?.level ?? "");
    } catch (error) {
      setLevelError(error instanceof Error ? error.message : "Deine Kurse konnten nicht geladen werden.");
    } finally {
      setIsLevelLoading(false);
    }
  }

  async function saveCourseLevel() {
    const course = teacherCourses.find((item) => item.id === selectedCourseId);
    if (!course || !selectedLevel) return;
    setIsLevelSaving(true);
    setLevelError(null);
    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: selectedLevel }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Das Kursniveau konnte nicht geändert werden."));
      setTeacherCourses((current) => current.map((item) => item.id === course.id ? { ...item, level: selectedLevel } : item));
      onNotice(`${course.code} wurde auf Niveau ${selectedLevel} geändert.`);
      setIsLevelEditorOpen(false);
    } catch (error) {
      setLevelError(error instanceof Error ? error.message : "Das Kursniveau konnte nicht geändert werden.");
    } finally {
      setIsLevelSaving(false);
    }
  }

  return <section className="role-workspace" aria-labelledby="teacher-title">
    <div className="role-workspace__intro"><p className="eyebrow">Lehrpersonenbereich</p><h2 id="teacher-title">Guten Abend, {userName}.</h2><p>Du siehst nur deine heutigen Lektionen und die dafür nötigen Teilnahmedaten.</p></div>
    <article className="teacher-lesson"><div><span className="status-pill">Heute · 18:00 Uhr</span><h3>Deutsch A2 · Abendkurs</h3><p>Schaffhausen 1 · Raum A1 · 5 Teilnehmende</p></div><button className="primary-button" type="button" onClick={openAttendance}>Anwesenheit erfassen</button></article>
    <div className="teacher-grid"><article><span>Danach</span><h3>Unterrichtsinhalt ergänzen</h3><p>Notiere Ablauf, Hausaufgaben und besondere Vorkommnisse direkt bei der Lektion.</p><button type="button" onClick={() => onNotice("Die Lektionsplanung öffnet sich nach Auswahl der konkreten Lektion.")}>Lektionsplanung öffnen →</button></article><article><span>Kursniveau</span><h3>Niveau selbst aktualisieren</h3><p>Du kannst das Niveau deiner eigenen Kurse ändern. Die Kurskennung bleibt beim Büro.</p><button type="button" onClick={() => void openLevelEditor()}>Kursniveau bearbeiten →</button></article></div>
    {isAttendanceOpen ? <div className="dialog-backdrop" role="presentation"><section className="attendance-dialog" aria-labelledby="attendance-title" role="dialog" aria-modal="true"><button aria-label="Anwesenheit schliessen" className="dialog-close" onClick={() => setIsAttendanceOpen(false)} type="button">×</button><p className="eyebrow">{attendanceLesson ? `${attendanceLesson.code} · ${new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(new Date(attendanceLesson.starts_at))}` : "Anwesenheit"}</p><h2 id="attendance-title">Anwesenheit</h2><p className="dialog-course">Bitte nach der stattgefundenen Lektion bestätigen.</p>{isAttendanceLoading ? <p aria-live="polite">Anwesenheiten werden geladen …</p> : attendanceError ? <p aria-live="assertive" className="dialog-note">{attendanceError}</p> : <div className="attendance-list">{attendanceEntries.map((entry) => <div key={entry.enrollment_id}><strong>{entry.participant_name}</strong><select aria-label={`${entry.participant_name} Anwesenheit`} value={attendance[entry.enrollment_id] ?? "present"} onChange={(event) => setAttendance((current) => ({ ...current, [entry.enrollment_id]: event.target.value as AttendanceStatus }))}>{attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>)}</div>}<div className="dialog-actions"><button className="quiet-button" disabled={isAttendanceSaving} onClick={() => setIsAttendanceOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isAttendanceLoading || isAttendanceSaving || !attendanceLesson || attendanceEntries.length === 0} onClick={saveAttendance} type="button">{isAttendanceSaving ? "Wird gespeichert …" : "Anwesenheit bestätigen"}</button></div></section></div> : null}
    {isLevelEditorOpen ? <div className="dialog-backdrop" role="presentation"><section className="attendance-dialog" aria-labelledby="course-level-title" role="dialog" aria-modal="true"><button aria-label="Kursniveau schliessen" className="dialog-close" onClick={() => setIsLevelEditorOpen(false)} type="button">×</button><p className="eyebrow">Meine Kurse</p><h2 id="course-level-title">Kursniveau bearbeiten</h2>{isLevelLoading ? <p className="planner-state">Kurse werden geladen …</p> : levelError && teacherCourses.length === 0 ? <p className="dialog-note" role="alert">{levelError}</p> : teacherCourses.length === 0 ? <p className="planner-state">Dir sind noch keine Kurse zugeordnet.</p> : <div className="form-grid"><label>Kurs<select aria-label="Kurs auswählen" onChange={(event) => { setSelectedCourseId(event.target.value); setSelectedLevel(teacherCourses.find((course) => course.id === event.target.value)?.level ?? ""); }} value={selectedCourseId}>{teacherCourses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.language} {course.level}</option>)}</select></label><label>Neues Niveau<select aria-label="Neues Niveau" onChange={(event) => setSelectedLevel(event.target.value)} value={selectedLevel}>{COURSE_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label></div>}{levelError && teacherCourses.length > 0 ? <p className="dialog-note" role="alert">{levelError}</p> : null}<div className="dialog-actions"><button className="quiet-button" disabled={isLevelSaving} onClick={() => setIsLevelEditorOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isLevelLoading || isLevelSaving || teacherCourses.length === 0 || !selectedLevel} onClick={() => void saveCourseLevel()} type="button">{isLevelSaving ? "Wird gespeichert …" : "Niveau speichern"}</button></div></section></div> : null}
  </section>;
}

type NextLesson = {
  starts_at: string;
  duration_minutes: number | string;
  status: "scheduled" | "cancelled";
  course_code: string;
  course_language: string;
  course_level: string;
  room_name: string | null;
  location_name: string | null;
  teacher_name: string;
};

function ParticipantWorkspace({ userName }: { userName: string }) {
  const [nextLessons, setNextLessons] = useState<NextLesson[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(async () => {
      try {
        const response = await fetch("/api/participant/next-lessons", { credentials: "same-origin", signal: controller.signal });
        const payload = await response.json() as { lessons?: NextLesson[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Nächste Lektion konnte nicht geladen werden.");
        if (!controller.signal.aborted) setNextLessons(payload.lessons ?? []);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Nächste Lektion konnte nicht geladen werden.");
      }
    });
    return () => controller.abort();
  }, []);

  const nextLesson = nextLessons[0] ?? null;
  const date = nextLesson ? new Date(nextLesson.starts_at) : null;
  const end = date && nextLesson ? new Date(date.getTime() + Number(nextLesson.duration_minutes) * 60_000) : null;

  return <section className="role-workspace participant-workspace" aria-labelledby="participant-title">
    <div className="role-workspace__intro"><p className="eyebrow">Mein Kurs</p><h2 id="participant-title">Hallo {userName}.</h2><p>Hier findest du deine nächsten Termine und wichtige Änderungen.</p></div>
    {loadError ? <p className="planner-state" role="alert">{loadError}</p> : nextLesson && date && end ? <article className="next-lesson-card"><div className="next-lesson-card__date"><strong>{new Intl.DateTimeFormat("de-CH", { weekday: "short" }).format(date)}</strong><span>{new Intl.DateTimeFormat("de-CH", { day: "2-digit" }).format(date)}</span><small>{new Intl.DateTimeFormat("de-CH", { month: "short" }).format(date)}</small></div><div><span className="status-pill">{nextLesson.status === "cancelled" ? "Abgesagt" : "Nächste Lektion"}</span><h3>{nextLesson.course_language} {nextLesson.course_level}</h3><p>{new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(date)}–{new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(end)} Uhr · {nextLesson.location_name ?? "Raum wird bekanntgegeben"} · {nextLesson.room_name ?? ""}</p><p className="teacher-line">Lehrperson: {nextLesson.teacher_name}</p></div></article> : <p className="planner-state">Es ist keine kommende Lektion geplant.</p>}
    {nextLessons.length > 1 ? <section className="upcoming-lessons" aria-labelledby="upcoming-lessons-title"><p className="eyebrow">Weitere Termine</p><h3 id="upcoming-lessons-title">Die nächsten Kursdaten</h3>{nextLessons.slice(1, 6).map((lesson) => { const lessonDate = new Date(lesson.starts_at); const lessonEnd = new Date(lessonDate.getTime() + Number(lesson.duration_minutes) * 60_000); return <article key={`${lesson.starts_at}-${lesson.course_code}`}><strong>{new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "long" }).format(lessonDate)}</strong><span>{new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(lessonDate)}–{new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(lessonEnd)} Uhr</span><span>{lesson.location_name ?? "Raum wird bekanntgegeben"} · {lesson.room_name ?? ""}</span>{lesson.status === "cancelled" ? <em>Abgesagt</em> : null}</article>; })}</section> : null}
  </section>;
}
