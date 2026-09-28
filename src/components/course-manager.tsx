"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { COURSE_LEVELS, COURSE_STATUSES } from "@/lib/types";
import type { Course, CourseLevel, CourseSizeKind, CourseStatus, Language, Location, Person, Room } from "@/lib/types";
import { ApiError } from "@/lib/api-client";

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const DURATIONS = [45, 60, 75, 90, 120, 150, 180];
const STATUS_LABELS: Record<CourseStatus, string> = {
  planned: "Geplant",
  active: "Aktiv",
  paused: "Pausiert",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
};

type ScheduleForm = { weekday: string; startTime: string; durationMinutes: string };

type FormState = {
  languageId: string;
  level: CourseLevel;
  courseSizeKindId: string;
  teacherId: string;
  standardRoomId: string;
  status: CourseStatus;
  startsOn: string;
  endsOn: string;
  schedules: ScheduleForm[];
};

function emptyForm(languages: Language[], sizeKinds: CourseSizeKind[], teachers: Person[]): FormState {
  return {
    languageId: languages[0]?.id ?? "",
    level: "A1",
    courseSizeKindId: sizeKinds[0]?.id ?? "",
    teacherId: teachers[0]?.id ?? "",
    standardRoomId: "",
    status: "planned",
    startsOn: new Date().toISOString().slice(0, 10),
    endsOn: "",
    schedules: [{ weekday: "1", startTime: "18:30", durationMinutes: "90" }],
  };
}

export function CourseManager({
  initialCourses,
  languages,
  sizeKinds,
  teachers,
  locations,
  rooms,
}: {
  initialCourses: Course[];
  languages: Language[];
  sizeKinds: CourseSizeKind[];
  teachers: Person[];
  locations: Location[];
  rooms: Room[];
}) {
  const [items, setItems] = useState(() => initialCourses);
  const [form, setForm] = useState<FormState>(() => emptyForm(languages, sizeKinds, teachers));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCreate = languages.length > 0 && sizeKinds.length > 0 && teachers.length > 0;

  function reset() {
    setForm(emptyForm(languages, sizeKinds, teachers));
    setEditingId(null);
    setError(null);
  }

  function startEdit(course: Course) {
    setEditingId(course.id);
    setForm({
      languageId: course.languageId,
      level: course.level,
      courseSizeKindId: course.courseSizeKindId,
      teacherId: course.teacherId,
      standardRoomId: course.standardRoomId ?? "",
      status: course.status,
      startsOn: course.startsOn,
      endsOn: course.endsOn ?? "",
      schedules:
        course.schedules.length > 0
          ? course.schedules.map((schedule) => ({
              weekday: String(schedule.weekday),
              startTime: schedule.startTime,
              durationMinutes: String(schedule.durationMinutes),
            }))
          : [{ weekday: "1", startTime: "18:30", durationMinutes: "90" }],
    });
    setError(null);
    setNotice(null);
  }

  function updateSchedule(index: number, patch: Partial<ScheduleForm>) {
    setForm((current) => ({
      ...current,
      schedules: current.schedules.map((schedule, position) => (position === index ? { ...schedule, ...patch } : schedule)),
    }));
  }

  function addSchedule() {
    setForm((current) => ({ ...current, schedules: [...current.schedules, { weekday: "1", startTime: "18:30", durationMinutes: "90" }] }));
  }

  function removeSchedule(index: number) {
    setForm((current) => ({ ...current, schedules: current.schedules.filter((_, position) => position !== index) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (form.schedules.length === 0) {
      setError("Bitte mindestens einen Wochentag angeben.");
      return;
    }
    setSaving(true);
    const payload = {
      languageId: form.languageId,
      level: form.level,
      courseSizeKindId: form.courseSizeKindId,
      teacherId: form.teacherId,
      standardRoomId: form.standardRoomId || null,
      status: form.status,
      startsOn: form.startsOn,
      endsOn: form.endsOn || null,
      schedules: form.schedules.map((schedule) => ({
        weekday: Number(schedule.weekday),
        startTime: schedule.startTime,
        durationMinutes: Number(schedule.durationMinutes),
      })),
    };
    try {
      if (editingId) {
        const { course } = await api.patch<{ course: Course }>(`/api/courses/${editingId}`, payload);
        setItems((current) => current.map((item) => (item.id === course.id ? course : item)));
        setNotice(`Kurs aktualisiert${course.code !== items.find((i) => i.id === course.id)?.code ? " (Kennung geändert)" : ""}.`);
      } else {
        const { course } = await api.post<{ course: Course }>("/api/courses", payload);
        setItems((current) => [...current, course]);
        setNotice(`Kurs «${course.code}» angelegt.`);
      }
      reset();
    } catch (caught) {
      setError(caught instanceof ApiError && caught.issues ? `${caught.message}` : errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>{editingId ? "Kurs bearbeiten" : "Neuer Kurs"}</h2>
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        {!canCreate ? (
          <p className="empty">Bitte zuerst Sprachen, Kursarten und Lehrpersonen erfassen.</p>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <label className="field">
                <span>Sprache</span>
                <select onChange={(event) => setForm({ ...form, languageId: event.target.value })} value={form.languageId}>
                  {languages.map((language) => (
                    <option key={language.id} value={language.id}>
                      {language.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Niveau</span>
                <select onChange={(event) => setForm({ ...form, level: event.target.value as CourseLevel })} value={form.level}>
                  {COURSE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Kursart</span>
                <select onChange={(event) => setForm({ ...form, courseSizeKindId: event.target.value })} value={form.courseSizeKindId}>
                  {sizeKinds.map((kind) => (
                    <option key={kind.id} value={kind.id}>
                      {kind.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Lehrperson</span>
                <select onChange={(event) => setForm({ ...form, teacherId: event.target.value })} value={form.teacherId}>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Standardraum</span>
                <select onChange={(event) => setForm({ ...form, standardRoomId: event.target.value })} value={form.standardRoomId}>
                  <option value="">–</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {locations.find((l) => l.id === room.locationId)?.name ?? room.locationName} · {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select onChange={(event) => setForm({ ...form, status: event.target.value as CourseStatus })} value={form.status}>
                  {COURSE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Startdatum</span>
                <input onChange={(event) => setForm({ ...form, startsOn: event.target.value })} required type="date" value={form.startsOn} />
              </label>
              <label className="field">
                <span>Enddatum (optional)</span>
                <input onChange={(event) => setForm({ ...form, endsOn: event.target.value })} type="date" value={form.endsOn} />
              </label>
            </div>

            <div className="field field--full" style={{ marginTop: "0.9rem" }}>
              <span>Wochentage</span>
              {form.schedules.map((schedule, index) => (
                <div className="form-grid" key={`schedule-${index.toString()}`} style={{ marginTop: "0.4rem" }}>
                  <label className="field">
                    <span>Tag</span>
                    <select onChange={(event) => updateSchedule(index, { weekday: event.target.value })} value={schedule.weekday}>
                      {WEEKDAYS.map((label, weekday) => (
                        <option key={label} value={String(weekday)}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Startzeit</span>
                    <input onChange={(event) => updateSchedule(index, { startTime: event.target.value })} type="time" value={schedule.startTime} />
                  </label>
                  <label className="field">
                    <span>Dauer (Min.)</span>
                    <select onChange={(event) => updateSchedule(index, { durationMinutes: event.target.value })} value={schedule.durationMinutes}>
                      {DURATIONS.map((duration) => (
                        <option key={duration} value={String(duration)}>
                          {duration}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-actions" style={{ marginTop: 0 }}>
                    <button className="button button--danger button--small" onClick={() => removeSchedule(index)} type="button">
                      Entfernen
                    </button>
                  </div>
                </div>
              ))}
              <button className="button button--secondary button--small" onClick={addSchedule} style={{ marginTop: "0.5rem" }} type="button">
                + Wochentag
              </button>
            </div>

            <div className="form-actions">
              <button className="button" disabled={saving} type="submit">
                {saving ? "Speichern …" : editingId ? "Änderungen speichern" : "Kurs anlegen"}
              </button>
              {editingId ? (
                <button className="button button--secondary" onClick={reset} type="button">
                  Abbrechen
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>

      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="card">
        <h2>Kurse</h2>
        {items.length === 0 ? (
          <p className="empty">Noch keine Kurse erfasst.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Kennung</th>
                <th>Sprache</th>
                <th>Niveau</th>
                <th>Kursart</th>
                <th>Lehrperson</th>
                <th>Wochentage</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((course) => (
                <tr key={course.id}>
                  <td>{course.code}</td>
                  <td>{course.languageName}</td>
                  <td>{course.level}</td>
                  <td>{course.courseSizeKindName}</td>
                  <td>{course.teacherName}</td>
                  <td>{course.schedules.map((schedule) => `${WEEKDAYS[schedule.weekday]?.slice(0, 2)} ${schedule.startTime}`).join(", ") || "–"}</td>
                  <td>
                    <span className={`badge ${course.status === "active" ? "badge--active" : "badge--inactive"}`}>
                      {STATUS_LABELS[course.status]}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button button--secondary button--small" onClick={() => startEdit(course)} type="button">
                        Bearbeiten
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
