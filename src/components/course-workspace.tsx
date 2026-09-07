"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { COURSE_LEVELS } from "@/lib/course-levels";

type Course = { id: string; code: string; language: string; level: string; duration_minutes: number; status: string; teacher_name: string };
type Teacher = { id: string; name: string; teaching_levels?: Array<{ language: string; levels: string[] }> };
type Room = { id: string; name: string; location_name: string };
type CourseSchedule = { id: string; course_id: string; weekday: number; start_time: string; duration_minutes: number };
type CourseParticipant = { id: string; course_id: string; participant_id: string; participant_name: string; participant_email: string; active: boolean };
type WeeklySlot = { weekday: number; startTime: string };
type ScheduleDraft = { weekday: number; startTime: string };

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function getError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

function qualificationLevel(level: string) {
  return level.slice(0, 2).replace("+", "");
}

function teacherCanTeach(teacher: Teacher, language: string, level: string) {
  const requestedLanguage = language.trim().toLocaleLowerCase();
  const requestedLevel = qualificationLevel(level);
  return (teacher.teaching_levels ?? []).some((entry) => entry.language.trim().toLocaleLowerCase() === requestedLanguage && entry.levels.includes(requestedLevel));
}

export function CourseWorkspace({ initiallyOpen = false, focusCourseId = null, onOpenParticipant }: { initiallyOpen?: boolean; focusCourseId?: string | null; onOpenParticipant?: (participantId: string) => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [courseParticipants, setCourseParticipants] = useState<CourseParticipant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([{ weekday: 0, startTime: "18:00" }]);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [scheduleEdits, setScheduleEdits] = useState<Record<string, ScheduleDraft>>({});
  const [newSchedule, setNewSchedule] = useState<ScheduleDraft>({ weekday: 0, startTime: "18:00" });
  const [newCourseLanguage, setNewCourseLanguage] = useState("");
  const [newCourseLevel, setNewCourseLevel] = useState("A1");
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const [coursesResponse, teachersResponse, roomsResponse, schedulesResponse] = await Promise.all([
        fetch("/api/courses", { credentials: "same-origin" }),
        fetch("/api/teachers", { credentials: "same-origin" }),
        fetch("/api/rooms", { credentials: "same-origin" }),
        fetch("/api/course-schedules", { credentials: "same-origin" }),
      ]);
      const [coursesPayload, teachersPayload, roomsPayload, schedulesPayload] = await Promise.all([coursesResponse.json(), teachersResponse.json(), roomsResponse.json(), schedulesResponse.json()]);
      if (!coursesResponse.ok) throw new Error(getError(coursesPayload, "Kurse konnten nicht geladen werden."));
      if (!teachersResponse.ok) throw new Error(getError(teachersPayload, "Lehrpersonen konnten nicht geladen werden."));
      if (!roomsResponse.ok) throw new Error(getError(roomsPayload, "Räume konnten nicht geladen werden."));
      if (!schedulesResponse.ok) throw new Error(getError(schedulesPayload, "Wochenpläne konnten nicht geladen werden."));
      setCourses((coursesPayload as { courses: Course[] }).courses);
      setTeachers((teachersPayload as { teachers: Teacher[] }).teachers);
      setRooms((roomsPayload as { rooms: Room[] }).rooms);
      setSchedules((schedulesPayload as { schedules: CourseSchedule[] }).schedules);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Kurse konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { queueMicrotask(() => void load()); }, []);

  const schedulesByCourse = useMemo(() => {
    const map = new Map<string, CourseSchedule[]>();
    schedules.forEach((schedule) => map.set(schedule.course_id, [...(map.get(schedule.course_id) ?? []), schedule]));
    return map;
  }, [schedules]);
  const qualifiedTeachers = useMemo(
    () => teachers.filter((teacher) => teacherCanTeach(teacher, newCourseLanguage, newCourseLevel)),
    [newCourseLanguage, newCourseLevel, teachers],
  );

  function toggleWeekday(weekday: number) {
    setWeeklySlots((current) => current.some((slot) => slot.weekday === weekday)
      ? current.filter((slot) => slot.weekday !== weekday)
      : [...current, { weekday, startTime: "18:00" }].sort((left, right) => left.weekday - right.weekday));
  }

  function setSlotTime(weekday: number, startTime: string) {
    setWeeklySlots((current) => current.map((slot) => slot.weekday === weekday ? { ...slot, startTime } : slot));
  }

  function scheduleDraft(schedule: CourseSchedule): ScheduleDraft {
    return scheduleEdits[schedule.id] ?? {
      weekday: schedule.weekday,
      startTime: String(schedule.start_time).slice(0, 5),
    };
  }

  function updateScheduleDraft(id: string, changes: Partial<ScheduleDraft>) {
    const schedule = schedules.find((item) => item.id === id);
    if (!schedule) return;
    setScheduleEdits((current) => ({ ...current, [id]: { ...scheduleDraft(schedule), ...changes } }));
  }

  const loadCourseParticipants = useCallback(async (courseId: string) => {
    setIsLoadingParticipants(true);
    try {
      const response = await fetch("/api/enrollments", { credentials: "same-origin" });
      const payload = await response.json() as { enrollments?: CourseParticipant[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Teilnehmende konnten nicht geladen werden.");
      setCourseParticipants((payload.enrollments ?? []).filter((enrollment) => enrollment.course_id === courseId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Teilnehmende konnten nicht geladen werden.");
      setCourseParticipants([]);
    } finally {
      setIsLoadingParticipants(false);
    }
  }, []);

  const openEditor = useCallback((course: Course) => {
    const occupiedWeekdays = new Set((schedulesByCourse.get(course.id) ?? []).map((schedule) => schedule.weekday));
    const firstAvailableWeekday = weekdays.findIndex((_, weekday) => !occupiedWeekdays.has(weekday));
    setEditingCourse(course);
    setScheduleEdits({});
    setNewSchedule({
      weekday: firstAvailableWeekday === -1 ? 0 : firstAvailableWeekday,
      startTime: "18:00",
    });
    void loadCourseParticipants(course.id);
  }, [loadCourseParticipants, schedulesByCourse]);

  useEffect(() => {
    if (!focusCourseId) return;
    const course = courses.find((item) => item.id === focusCourseId);
    if (course && editingCourse?.id !== course.id) queueMicrotask(() => openEditor(course));
  }, [courses, editingCourse?.id, focusCourseId, openEditor]);

  async function removeCourseParticipant(enrollment: CourseParticipant) {
    if (!window.confirm(`${enrollment.participant_name} aus diesem Kurs entfernen?`)) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/enrollments/${enrollment.id}`, { method: "DELETE", credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(getError(payload, "Teilnahme konnte nicht entfernt werden."));
      setCourseParticipants((current) => current.map((item) => item.id === enrollment.id ? { ...item, active: false } : item));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Teilnahme konnte nicht entfernt werden.");
    } finally {
      setIsSaving(false);
    }
  }

  function openCreateDialog() {
    setNewCourseLanguage("");
    setNewCourseLevel("A1");
    setIsOpen(true);
  }

  function closeEditor() {
    setEditingCourse(null);
    setScheduleEdits({});
  }

  async function createCourse(formData: FormData) {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.get("code"), language: formData.get("language"), level: formData.get("level"),
          teacherId: formData.get("teacherId"), standardRoomId: formData.get("roomId"),
          durationMinutes: Number(formData.get("durationMinutes")),
          startsOn: formData.get("startsOn"),
          schedules: weeklySlots,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getError(payload, "Kurs konnte nicht gespeichert werden."));
      setIsOpen(false);
      setWeeklySlots([{ weekday: 0, startTime: "18:00" }]);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kurs konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateCourse(formData: FormData) {
    if (!editingCourse) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/courses/${editingCourse.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: formData.get("code"), level: formData.get("level"), status: formData.get("status") }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getError(payload, "Kurs konnte nicht aktualisiert werden."));
      closeEditor();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kurs konnte nicht aktualisiert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSchedule(schedule: CourseSchedule) {
    if (!editingCourse) return;
    setIsSaving(true);
    setError(null);
    try {
      const draft = scheduleDraft(schedule);
      const response = await fetch("/api/course-schedules", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: schedule.id, courseId: editingCourse.id, ...draft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getError(payload, "Termin konnte nicht aktualisiert werden."));
      setScheduleEdits((current) => {
        const remaining = { ...current };
        delete remaining[schedule.id];
        return remaining;
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Termin konnte nicht aktualisiert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addSchedule() {
    if (!editingCourse) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/course-schedules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: editingCourse.id, ...newSchedule }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getError(payload, "Termin konnte nicht hinzugefügt werden."));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Termin konnte nicht hinzugefügt werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSchedule(schedule: CourseSchedule) {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/course-schedules", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: schedule.id }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(getError(payload, "Termin konnte nicht gelöscht werden."));
      }
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Termin konnte nicht gelöscht werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return <section className="management-preview" aria-labelledby="courses-title">
    <div className="preview-intro"><p className="eyebrow">Kursverwaltung</p><h2 id="courses-title">Kurse <span>{courses.length}</span></h2><p>Standardlehrperson, Raum, Niveau und Dauer werden zentral durch das Büro gepflegt.</p><button className="primary-button" onClick={openCreateDialog} type="button">+ Kurs anlegen</button></div>
    {error ? <p className="planner-state" role="alert">{error}</p> : null}
    {isLoading ? <p className="planner-state">Kurse werden geladen …</p> : <div className="preview-grid">{courses.length === 0 ? <p className="planner-state">Noch keine Kurse angelegt.</p> : courses.map((course) => <article key={course.id}><span>{course.status}</span><h3>{course.code}</h3><p>{course.language} {course.level} · {course.teacher_name}</p><p>{course.duration_minutes} Minuten</p><p className="course-schedule-summary">{(schedulesByCourse.get(course.id) ?? []).map((schedule) => `${weekdays[schedule.weekday]} ${String(schedule.start_time).slice(0, 5)}`).join(" · ") || "Noch keine Termine"}</p><button className="quiet-button" onClick={() => openEditor(course)} type="button">Kurs bearbeiten</button></article>)}</div>}
    {isOpen ? <div className="dialog-backdrop" role="presentation"><form action={createCourse} className="attendance-dialog" aria-labelledby="create-course-title"><button aria-label="Kursformular schliessen" className="dialog-close" onClick={() => setIsOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-course-title">Neuer Kurs</h2><div className="form-grid"><label>Kurskennung<input name="code" required pattern="[A-Z0-9]+" placeholder="MARKELDEA201" /></label><label>Sprache<input name="language" onChange={(event) => setNewCourseLanguage(event.target.value)} required placeholder="Deutsch" value={newCourseLanguage} /></label><label>Niveau<select name="level" onChange={(event) => setNewCourseLevel(event.target.value)} value={newCourseLevel}>{COURSE_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label><label>Lehrperson<select name="teacherId" required defaultValue=""><option disabled value="">{newCourseLanguage ? qualifiedTeachers.length > 0 ? "Bitte wählen" : "Keine passende Qualifikation" : "Zuerst Sprache wählen"}</option>{qualifiedTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label><label>Startdatum<input defaultValue={new Date().toISOString().slice(0, 10)} name="startsOn" required type="date" /></label><label>Standardraum<select name="roomId" required defaultValue=""><option disabled value="">Bitte wählen</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.location_name} · {room.name}</option>)}</select></label><label>Dauer<select name="durationMinutes" defaultValue="90">{[45, 60, 75, 90, 120, 150, 180].map((minutes) => <option key={minutes} value={minutes}>{minutes} Minuten</option>)}</select></label></div>{newCourseLanguage && qualifiedTeachers.length === 0 ? <p className="form-hint" role="status">Für {newCourseLanguage} {newCourseLevel} ist keine Lehrperson mit passender Niveaufreigabe hinterlegt.</p> : null}<fieldset className="weekly-schedule"><legend>Wöchentliche Termine</legend><p>Wähle die Unterrichtstage. Für jeden Tag kann eine eigene Startzeit hinterlegt werden.</p><div className="weekday-buttons">{weekdays.map((weekday, index) => <button aria-pressed={weeklySlots.some((slot) => slot.weekday === index)} className={weeklySlots.some((slot) => slot.weekday === index) ? "is-selected" : ""} key={weekday} onClick={() => toggleWeekday(index)} type="button">{weekday.slice(0, 2)}</button>)}</div>{weeklySlots.map((slot) => <label className="weekly-time" key={slot.weekday}>{weekdays[slot.weekday]}<input aria-label={`${weekdays[slot.weekday]} Startzeit`} onChange={(event) => setSlotTime(slot.weekday, event.target.value)} required type="time" value={slot.startTime} /></label>)}</fieldset><div className="dialog-actions"><button className="quiet-button" onClick={() => setIsOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving || weeklySlots.length === 0 || qualifiedTeachers.length === 0} type="submit">{isSaving ? "Wird gespeichert …" : "Kurs speichern"}</button></div></form></div> : null}
    {editingCourse ? <div className="dialog-backdrop" role="presentation"><form action={updateCourse} className="attendance-dialog" aria-labelledby="edit-course-title"><button aria-label="Kursbearbeitung schliessen" className="dialog-close" onClick={closeEditor} type="button">×</button><p className="eyebrow">Kursverwaltung</p><h2 id="edit-course-title">{editingCourse.code} bearbeiten</h2><div className="form-grid"><label>Kurskennung bearbeiten<input defaultValue={editingCourse.code} name="code" pattern="[A-Z0-9]+" required /></label><label>Niveau bearbeiten<select defaultValue={editingCourse.level} name="level">{COURSE_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label><label>Kursstatus<select aria-label="Kursstatus" defaultValue={editingCourse.status} name="status"><option value="planned">Geplant</option><option value="active">Laufend</option><option value="paused">Pausiert</option><option value="completed">Abgeschlossen</option><option value="cancelled">Abgesagt</option></select></label></div><div className="dialog-actions"><button className="quiet-button" onClick={closeEditor} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? "Wird gespeichert …" : "Kursdaten speichern"}</button></div></form><section className="attendance-dialog" aria-labelledby="course-schedule-title"><h2 id="course-schedule-title">Wöchentliche Termine</h2><p>Die Kursdauer ist verbindlich; pro Tag wird nur die Startzeit gepflegt.</p>{(schedulesByCourse.get(editingCourse.id) ?? []).map((schedule) => { const draft = scheduleDraft(schedule); return <fieldset className="weekly-schedule" key={schedule.id}><legend>{weekdays[draft.weekday]}</legend><div className="form-grid"><label>Wochentag<select aria-label={`${schedule.id} Wochentag`} disabled={isSaving} onChange={(event) => updateScheduleDraft(schedule.id, { weekday: Number(event.target.value) })} value={draft.weekday}>{weekdays.map((weekdayName, weekdayIndex) => <option key={weekdayName} value={weekdayIndex}>{weekdayName}</option>)}</select></label><label>Startzeit<input aria-label={`${schedule.id} Startzeit`} disabled={isSaving} onChange={(event) => updateScheduleDraft(schedule.id, { startTime: event.target.value })} required type="time" value={draft.startTime} /></label><label>Dauer<input aria-label={`${schedule.id} Dauer`} disabled readOnly value={`${editingCourse.duration_minutes} Minuten`} /></label></div><div className="dialog-actions"><button className="quiet-button" disabled={isSaving} onClick={() => void deleteSchedule(schedule)} type="button">Termin löschen</button><button className="primary-button" disabled={isSaving} onClick={() => void saveSchedule(schedule)} type="button">Termin speichern</button></div></fieldset>; })}<fieldset className="weekly-schedule"><legend>Termin hinzufügen</legend><div className="form-grid"><label>Wochentag<select aria-label="Neuer Termin Wochentag" disabled={isSaving} onChange={(event) => setNewSchedule((current) => ({ ...current, weekday: Number(event.target.value) }))} value={newSchedule.weekday}>{weekdays.map((weekdayName, weekdayIndex) => <option key={weekdayName} value={weekdayIndex}>{weekdayName}</option>)}</select></label><label>Startzeit<input aria-label="Neue Startzeit" disabled={isSaving} onChange={(event) => setNewSchedule((current) => ({ ...current, startTime: event.target.value }))} required type="time" value={newSchedule.startTime} /></label><label>Dauer<input aria-label="Neue Dauer" disabled readOnly value={`${editingCourse.duration_minutes} Minuten`} /></label></div><div className="dialog-actions"><button className="primary-button" disabled={isSaving} onClick={() => void addSchedule()} type="button">Termin hinzufügen</button></div></fieldset></section></div> : null}
    {editingCourse ? <section className="course-participants-floating" aria-labelledby="course-participants-title">
      <div className="course-participants-heading"><div><p className="eyebrow">Kursbelegung</p><h2 id="course-participants-title">Teilnehmende in {editingCourse.code}</h2></div><button aria-label="Teilnehmerliste schliessen" className="dialog-close" onClick={closeEditor} type="button">×</button></div>
      {isLoadingParticipants ? <p className="planner-state">Teilnehmende werden geladen …</p> : null}
      {!isLoadingParticipants && courseParticipants.filter((participant) => participant.active).length === 0 ? <p className="planner-state">Keine aktiven Teilnehmenden in diesem Kurs.</p> : null}
      <div className="course-participant-list">{courseParticipants.map((participant) => <div className={`course-participant-row${participant.active ? "" : " is-ended"}`} key={participant.id}><div><button className="course-link" onClick={() => onOpenParticipant?.(participant.participant_id)} type="button">{participant.participant_name}</button><span>{participant.participant_email}</span>{!participant.active ? <small>Teilnahme beendet</small> : null}</div>{participant.active ? <button className="quiet-button" disabled={isSaving} onClick={() => void removeCourseParticipant(participant)} type="button">Teilnahme beenden</button> : null}</div>)}</div>
      <p className="form-hint">Neue Einschreibungen werden in der Teilnehmerverwaltung angelegt.</p>
    </section> : null}
  </section>;
}
