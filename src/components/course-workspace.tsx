"use client";

import { useEffect, useMemo, useState } from "react";

import { COURSE_LEVELS } from "@/lib/course-levels";

type Course = { id: string; code: string; language: string; level: string; duration_minutes: number; status: string; teacher_name: string };
type Teacher = { id: string; name: string };
type Room = { id: string; name: string; location_name: string };
type CourseSchedule = { id: string; course_id: string; weekday: number; start_time: string; duration_minutes: number };
type WeeklySlot = { weekday: number; startTime: string };

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function getError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

export function CourseWorkspace({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([{ weekday: 0, startTime: "18:00" }]);
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
        fetch("/api/users?role=teacher", { credentials: "same-origin" }),
        fetch("/api/rooms", { credentials: "same-origin" }),
        fetch("/api/course-schedules", { credentials: "same-origin" }),
      ]);
      const [coursesPayload, teachersPayload, roomsPayload, schedulesPayload] = await Promise.all([coursesResponse.json(), teachersResponse.json(), roomsResponse.json(), schedulesResponse.json()]);
      if (!coursesResponse.ok) throw new Error(getError(coursesPayload, "Kurse konnten nicht geladen werden."));
      if (!teachersResponse.ok) throw new Error(getError(teachersPayload, "Lehrpersonen konnten nicht geladen werden."));
      if (!roomsResponse.ok) throw new Error(getError(roomsPayload, "Räume konnten nicht geladen werden."));
      if (!schedulesResponse.ok) throw new Error(getError(schedulesPayload, "Wochenpläne konnten nicht geladen werden."));
      setCourses((coursesPayload as { courses: Course[] }).courses);
      setTeachers((teachersPayload as { users: Teacher[] }).users);
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

  function toggleWeekday(weekday: number) {
    setWeeklySlots((current) => current.some((slot) => slot.weekday === weekday)
      ? current.filter((slot) => slot.weekday !== weekday)
      : [...current, { weekday, startTime: "18:00" }].sort((left, right) => left.weekday - right.weekday));
  }

  function setSlotTime(weekday: number, startTime: string) {
    setWeeklySlots((current) => current.map((slot) => slot.weekday === weekday ? { ...slot, startTime } : slot));
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
          teacherId: formData.get("teacherId"), standardRoomId: formData.get("roomId") || null,
          durationMinutes: Number(formData.get("durationMinutes")),
          schedules: weeklySlots.map((slot) => ({ ...slot, durationMinutes: Number(formData.get("durationMinutes")) })),
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

  return <section className="management-preview" aria-labelledby="courses-title">
    <div className="preview-intro"><p className="eyebrow">Kursverwaltung</p><h2 id="courses-title">Kurse <span>{courses.length}</span></h2><p>Standardlehrperson, Raum, Niveau und Dauer werden zentral durch das Büro gepflegt.</p><button className="primary-button" onClick={() => setIsOpen(true)} type="button">+ Kurs anlegen</button></div>
    {error ? <p className="planner-state" role="alert">{error}</p> : null}
    {isLoading ? <p className="planner-state">Kurse werden geladen …</p> : <div className="preview-grid">{courses.length === 0 ? <p className="planner-state">Noch keine Kurse angelegt.</p> : courses.map((course) => <article key={course.id}><span>{course.status}</span><h3>{course.code}</h3><p>{course.language} {course.level} · {course.teacher_name}</p><p>{course.duration_minutes} Minuten</p><p className="course-schedule-summary">{(schedulesByCourse.get(course.id) ?? []).map((schedule) => `${weekdays[schedule.weekday]} ${String(schedule.start_time).slice(0, 5)}`).join(" · ") || "Noch keine Termine"}</p></article>)}</div>}
    {isOpen ? <div className="dialog-backdrop" role="presentation"><form action={createCourse} className="attendance-dialog" aria-labelledby="create-course-title"><button aria-label="Kursformular schliessen" className="dialog-close" onClick={() => setIsOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-course-title">Neuer Kurs</h2><div className="form-grid"><label>Kurskennung<input name="code" required pattern="[A-Z0-9]+" placeholder="MARKELDEA201" /></label><label>Sprache<input name="language" required placeholder="Deutsch" /></label><label>Niveau<select defaultValue="A1" name="level">{COURSE_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label><label>Lehrperson<select name="teacherId" required defaultValue=""><option disabled value="">Bitte wählen</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label><label>Standardraum<select name="roomId" defaultValue=""><option value="">Noch nicht festgelegt</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.location_name} · {room.name}</option>)}</select></label><label>Dauer<select name="durationMinutes" defaultValue="90">{[45, 60, 75, 90, 120, 150, 180].map((minutes) => <option key={minutes} value={minutes}>{minutes} Minuten</option>)}</select></label></div><fieldset className="weekly-schedule"><legend>Wöchentliche Termine</legend><p>Wähle die Unterrichtstage. Für jeden Tag kann eine eigene Startzeit hinterlegt werden.</p><div className="weekday-buttons">{weekdays.map((weekday, index) => <button aria-pressed={weeklySlots.some((slot) => slot.weekday === index)} className={weeklySlots.some((slot) => slot.weekday === index) ? "is-selected" : ""} key={weekday} onClick={() => toggleWeekday(index)} type="button">{weekday.slice(0, 2)}</button>)}</div>{weeklySlots.map((slot) => <label className="weekly-time" key={slot.weekday}>{weekdays[slot.weekday]}<input aria-label={`${weekdays[slot.weekday]} Startzeit`} onChange={(event) => setSlotTime(slot.weekday, event.target.value)} required type="time" value={slot.startTime} /></label>)}</fieldset><div className="dialog-actions"><button className="quiet-button" onClick={() => setIsOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving || weeklySlots.length === 0} type="submit">{isSaving ? "Wird gespeichert …" : "Kurs speichern"}</button></div></form></div> : null}
  </section>;
}
