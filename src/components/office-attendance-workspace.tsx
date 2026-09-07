"use client";

import { useCallback, useEffect, useState } from "react";

type AttendanceStatus = "present" | "excused" | "unexcused" | "trial" | "online";

type Lesson = {
  id: string;
  code: string;
  language: string;
  level: string;
  starts_at: string;
  duration_minutes: number | string;
  room_name: string;
  location_name: string;
  status: "scheduled" | "completed" | "cancelled";
  participant_count: number | string;
};

type AttendanceEntry = {
  enrollment_id: string;
  participant_name: string;
  status: AttendanceStatus | null;
};

type OfficeAttendanceWorkspaceProps = {
  onNotice?: (message: string) => void;
};

const attendanceOptions: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "present", label: "Anwesend" },
  { value: "excused", label: "Entschuldigt" },
  { value: "unexcused", label: "Unentschuldigt" },
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

function lessonLabel(lesson: Lesson) {
  const time = new Intl.DateTimeFormat("de-CH", { hour: "2-digit", minute: "2-digit" }).format(new Date(lesson.starts_at));
  return `${time} · ${lesson.code} · ${lesson.location_name} / ${lesson.room_name}`;
}

export function OfficeAttendanceWorkspace({ onNotice }: OfficeAttendanceWorkspaceProps) {
  const [date, setDate] = useState(localDateForApi);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [isLoadingLessons, setIsLoadingLessons] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLessons = useCallback(async (requestedDate: string, signal?: AbortSignal) => {
    setIsLoadingLessons(true);
    setError(null);
    setEntries([]);
    setAttendance({});
    try {
      const response = await fetch(`/api/lessons?date=${encodeURIComponent(requestedDate)}`, { credentials: "same-origin", signal });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Lektionen konnten nicht geladen werden."));
      const loadedLessons = typeof payload === "object" && payload !== null && "lessons" in payload && Array.isArray(payload.lessons)
        ? payload.lessons as Lesson[]
        : [];
      const scheduledLessons = loadedLessons.filter((lesson) => lesson.status === "scheduled");
      if (!signal?.aborted) {
        setLessons(scheduledLessons);
        setSelectedLessonId(scheduledLessons[0]?.id ?? "");
      }
    } catch (loadError) {
      if (!signal?.aborted) {
        setLessons([]);
        setSelectedLessonId("");
        setError(loadError instanceof Error ? loadError.message : "Lektionen konnten nicht geladen werden.");
      }
    } finally {
      if (!signal?.aborted) setIsLoadingLessons(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadLessons(date, controller.signal));
    return () => controller.abort();
  }, [date, loadLessons]);

  const loadAttendance = useCallback(async (lessonId: string, signal?: AbortSignal) => {
    if (!lessonId) return;
    setIsLoadingAttendance(true);
    setError(null);
    try {
      const response = await fetch(`/api/attendance?lessonId=${encodeURIComponent(lessonId)}`, { credentials: "same-origin", signal });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Anwesenheiten konnten nicht geladen werden."));
      const loadedEntries = typeof payload === "object" && payload !== null && "attendance" in payload && Array.isArray(payload.attendance)
        ? payload.attendance as AttendanceEntry[]
        : [];
      if (!signal?.aborted) {
        setEntries(loadedEntries);
        setAttendance(Object.fromEntries(loadedEntries.map((entry) => [entry.enrollment_id, entry.status ?? "present"])) as Record<string, AttendanceStatus>);
      }
    } catch (loadError) {
      if (!signal?.aborted) {
        setEntries([]);
        setAttendance({});
        setError(loadError instanceof Error ? loadError.message : "Anwesenheiten konnten nicht geladen werden.");
      }
    } finally {
      if (!signal?.aborted) setIsLoadingAttendance(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (selectedLessonId) queueMicrotask(() => void loadAttendance(selectedLessonId, controller.signal));
    return () => controller.abort();
  }, [loadAttendance, selectedLessonId]);

  async function saveAttendance() {
    if (!selectedLessonId || entries.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLessonId,
          entries: entries.map((entry) => ({ enrollmentId: entry.enrollment_id, status: attendance[entry.enrollment_id] ?? "present" })),
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Anwesenheiten konnten nicht gespeichert werden."));
      onNotice?.("Anwesenheit wurde gespeichert.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Anwesenheiten konnten nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId);

  return <section className="management-preview" aria-labelledby="office-attendance-title">
    <div className="management-preview__header">
      <div><p className="eyebrow">Administration</p><h2 id="office-attendance-title">Anwesenheiten</h2><p>Wähle eine geplante Lektion und bestätige die Anwesenheit aller eingeschriebenen Personen.</p></div>
    </div>
    <div className="form-grid">
      <label>Datum<input aria-label="Datum" onChange={(event) => setDate(event.target.value)} type="date" value={date} /></label>
      <label>Lektion<select aria-label="Lektion auswählen" disabled={isLoadingLessons || lessons.length === 0} onChange={(event) => setSelectedLessonId(event.target.value)} value={selectedLessonId}><option value="">{isLoadingLessons ? "Lektionen werden geladen …" : "Keine geplante Lektion"}</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lessonLabel(lesson)}</option>)}</select></label>
    </div>
    {error ? <p className="planner-state" role="alert">{error}</p> : null}
    {selectedLesson ? <p className="dialog-course">{selectedLesson.language} {selectedLesson.level} · {selectedLesson.participant_count} eingeschrieben</p> : null}
    {isLoadingAttendance ? <p aria-live="polite" className="planner-state">Anwesenheiten werden geladen …</p> : null}
    {!isLoadingAttendance && selectedLessonId && !error ? <div className="attendance-list">{entries.length > 0 ? entries.map((entry) => <div key={entry.enrollment_id}><strong>{entry.participant_name}</strong><select aria-label={`${entry.participant_name} Anwesenheit`} onChange={(event) => setAttendance((current) => ({ ...current, [entry.enrollment_id]: event.target.value as AttendanceStatus }))} value={attendance[entry.enrollment_id] ?? "present"}>{attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>) : <p className="planner-state">Für diese Lektion gibt es keine aktiven Einschreibungen.</p>}</div> : null}
    <div className="dialog-actions"><button className="primary-button" disabled={isLoadingLessons || isLoadingAttendance || isSaving || !selectedLessonId || entries.length === 0} onClick={saveAttendance} type="button">{isSaving ? "Wird gespeichert …" : "Anwesenheit speichern"}</button></div>
  </section>;
}
