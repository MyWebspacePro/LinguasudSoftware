"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { TEACHER_ABSENCE_ACTIONS } from "@/lib/types";
import type { Course, Person, TeacherAbsence, TeacherAbsenceAction } from "@/lib/types";

const ACTION_LABELS: Record<TeacherAbsenceAction, string> = { pause: "Kurs pausiert", takeover: "Übernahme nötig" };
const STATUS_LABELS: Record<string, string> = { requested: "Offen", approved: "Bestätigt", rejected: "Abgelehnt" };

export function TeacherAbsenceManager({
  initialAbsences,
  teachers,
  courses,
  canDecide,
  selfId,
}: {
  initialAbsences: TeacherAbsence[];
  teachers: Person[];
  courses: Course[];
  canDecide: boolean;
  selfId: string;
}) {
  const [items, setItems] = useState(initialAbsences);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    teacherId: canDecide ? (teachers[0]?.id ?? "") : selfId,
    courseId: "",
    startsOn: new Date().toISOString().slice(0, 10),
    endsOn: new Date().toISOString().slice(0, 10),
    action: "pause" as TeacherAbsenceAction,
    note: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { absence } = await api.post<{ absence: TeacherAbsence }>("/api/absences/teacher", {
        teacherId: canDecide ? form.teacherId : undefined,
        courseId: form.courseId || null,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        action: form.action,
        note: form.note.trim() || null,
      });
      setItems((current) => [absence, ...current]);
      setNotice("Abwesenheit gemeldet.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function decide(absence: TeacherAbsence, status: "approved" | "rejected") {
    setError(null);
    setNotice(null);
    try {
      const { absence: updated } = await api.patch<{ absence: TeacherAbsence }>(`/api/absences/teacher/${absence.id}`, { status });
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <div className="card">
      <h2>Abwesenheiten Lehrpersonen</h2>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          {canDecide ? (
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
          ) : null}
          <label className="field">
            <span>Kurs (optional)</span>
            <select onChange={(event) => setForm({ ...form, courseId: event.target.value })} value={form.courseId}>
              <option value="">–</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Von</span>
            <input onChange={(event) => setForm({ ...form, startsOn: event.target.value })} required type="date" value={form.startsOn} />
          </label>
          <label className="field">
            <span>Bis</span>
            <input onChange={(event) => setForm({ ...form, endsOn: event.target.value })} required type="date" value={form.endsOn} />
          </label>
          <label className="field">
            <span>Aktion</span>
            <select onChange={(event) => setForm({ ...form, action: event.target.value as TeacherAbsenceAction })} value={form.action}>
              {TEACHER_ABSENCE_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action]}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--full">
            <span>Notiz</span>
            <input onChange={(event) => setForm({ ...form, note: event.target.value })} value={form.note} />
          </label>
        </div>
        <div className="form-actions">
          <button className="button" disabled={saving} type="submit">
            Abwesenheit melden
          </button>
        </div>
      </form>

      <table className="data" style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Lehrperson</th>
            <th>Kurs</th>
            <th>Zeitraum</th>
            <th>Aktion</th>
            <th>Status</th>
            <th aria-label="Aktionen" />
          </tr>
        </thead>
        <tbody>
          {items.map((absence) => (
            <tr key={absence.id}>
              <td>{absence.teacherName}</td>
              <td>{absence.courseCode ?? "–"}</td>
              <td>
                {absence.startsOn} – {absence.endsOn}
              </td>
              <td>{ACTION_LABELS[absence.action]}</td>
              <td>
                <span className={`badge ${absence.status === "approved" ? "badge--active" : "badge--inactive"}`}>
                  {STATUS_LABELS[absence.status]}
                </span>
              </td>
              <td>
                {canDecide && absence.status === "requested" ? (
                  <div className="row-actions">
                    <button className="button button--small" onClick={() => void decide(absence, "approved")} type="button">
                      Bestätigen
                    </button>
                    <button className="button button--secondary button--small" onClick={() => void decide(absence, "rejected")} type="button">
                      Ablehnen
                    </button>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 ? <p className="empty">Keine Abwesenheiten erfasst.</p> : null}
    </div>
  );
}
