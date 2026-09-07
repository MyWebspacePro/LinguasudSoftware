"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PersonRole = "office" | "teacher" | "participant";
type Person = { id: string; name: string; email: string; role: PersonRole; phone?: string | null; street?: string | null; postal_code?: string | null; city?: string | null; notes?: string | null; teacher_code?: string | null; rate_per_lesson?: number | null; course_count?: number; history?: Array<{ eventType: string; summary: string; occurredAt: string }> };
type Course = { id: string; code: string; language: string; level: string; teacher_id: string; teacher_name: string };
type Enrollment = { id: string; participant_id: string; course_id: string; billing_type: "private" | "authority"; credit_lessons: number | null; active: boolean; course_code: string; course_language: string; course_level: string };

function errorMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

export function PeopleWorkspace({ mode }: { mode: "participants" | "teachers" }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isParticipantMode = mode === "participants";
  const role: PersonRole = isParticipantMode ? "participant" : "teacher";
  const title = isParticipantMode ? "Teilnehmer" : "Lehrpersonen";

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [peopleResponse, coursesResponse, enrollmentsResponse] = await Promise.all([
        fetch(`/api/${role === "participant" ? "participants" : "teachers"}`, { credentials: "same-origin" }),
        fetch("/api/courses", { credentials: "same-origin" }),
        fetch("/api/enrollments", { credentials: "same-origin" }),
      ]);
      const [peoplePayload, coursesPayload, enrollmentsPayload] = await Promise.all([peopleResponse.json(), coursesResponse.json(), enrollmentsResponse.json()]);
      if (!peopleResponse.ok) throw new Error(errorMessage(peoplePayload, `${title} konnten nicht geladen werden.`));
      if (!coursesResponse.ok) throw new Error(errorMessage(coursesPayload, "Kurse konnten nicht geladen werden."));
      if (!enrollmentsResponse.ok) throw new Error(errorMessage(enrollmentsPayload, "Einschreibungen konnten nicht geladen werden."));
      const peopleData = peoplePayload as { users?: Person[]; participants?: Person[]; teachers?: Person[] };
      setPeople(peopleData.participants ?? peopleData.teachers ?? peopleData.users ?? []);
      setCourses((coursesPayload as { courses: Course[] }).courses);
      setEnrollments((enrollmentsPayload as { enrollments: Enrollment[] }).enrollments);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `${title} konnten nicht geladen werden.`);
    } finally {
      setIsLoading(false);
    }
  }, [role, title]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const enrollmentsByParticipant = useMemo(() => {
    const map = new Map<string, Enrollment[]>();
    enrollments.forEach((enrollment) => map.set(enrollment.participant_id, [...(map.get(enrollment.participant_id) ?? []), enrollment]));
    return map;
  }, [enrollments]);
  const coursesByTeacher = useMemo(() => {
    const map = new Map<string, Course[]>();
    courses.forEach((course) => map.set(course.teacher_id, [...(map.get(course.teacher_id) ?? []), course]));
    return map;
  }, [courses]);

  async function createPerson(formData: FormData) {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/${role === "participant" ? "participants" : "teachers"}`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), phone: formData.get("phone") || null, street: formData.get("street") || null, postalCode: formData.get("postalCode") || null, city: formData.get("city") || null, teacherCode: formData.get("teacherCode") || null, ratePerLesson: formData.get("ratePerLesson") ? Number(formData.get("ratePerLesson")) : null, notes: formData.get("notes") || null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Personenkonto konnte nicht angelegt werden."));
      setPersonDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Personenkonto konnte nicht angelegt werden.");
    } finally {
      setIsCreating(false);
    }
  }

  async function updatePerson(formData: FormData) {
    if (!editingPerson) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/${role === "participant" ? "participants" : "teachers"}/${editingPerson.id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), phone: formData.get("phone") || null, street: formData.get("street") || null, postalCode: formData.get("postalCode") || null, city: formData.get("city") || null, teacherCode: formData.get("teacherCode") || null, ratePerLesson: formData.get("ratePerLesson") ? Number(formData.get("ratePerLesson")) : null, notes: formData.get("notes") || null }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Daten konnten nicht geändert werden."));
      setEditingPerson(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Daten konnten nicht geändert werden.");
    } finally {
      setIsCreating(false);
    }
  }

  async function createEnrollment(formData: FormData) {
    setIsEnrolling(true);
    setError(null);
    try {
      const billingType = formData.get("billingType");
      const response = await fetch("/api/enrollments", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: formData.get("participantId"), courseId: formData.get("courseId"), billingType,
          creditLessons: billingType === "private" ? Number(formData.get("creditLessons")) : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Einschreibung konnte nicht gespeichert werden."));
      setEnrollmentDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Einschreibung konnte nicht gespeichert werden.");
    } finally {
      setIsEnrolling(false);
    }
  }

  return <section className="management-preview" aria-labelledby="people-title">
    <div className="preview-intro"><p className="eyebrow">{isParticipantMode ? "Teilnahmen & Guthaben" : "Kurszuordnung"}</p><h2 id="people-title">{title} <span>{people.length}</span></h2><p>{isParticipantMode ? "Teilnehmerzugänge, Kurszuordnungen und Guthaben werden vom Büro geführt." : "Lehrpersonen erhalten einen eigenen Zugang und sehen ausschliesslich ihre eigenen Lektionen."}</p><div className="workspace-actions"><button className="primary-button" onClick={() => setPersonDialogOpen(true)} type="button">+ {isParticipantMode ? "Teilnehmer anlegen" : "Lehrperson anlegen"}</button>{isParticipantMode ? <button className="quiet-button" onClick={() => setEnrollmentDialogOpen(true)} type="button">+ In Kurs einschreiben</button> : null}</div></div>
    {error ? <p className="planner-state" role="alert">{error}</p> : null}
    {isLoading ? <p className="planner-state">{title} werden geladen …</p> : <div className="preview-grid">{people.length === 0 ? <p className="planner-state">Noch keine {isParticipantMode ? "Teilnehmer" : "Lehrpersonen"} angelegt.</p> : people.map((person) => <article key={person.id}><span>{isParticipantMode ? "Teilnehmer" : "Lehrperson"}</span><h3>{person.name}</h3><p>{person.email}</p><p className="course-schedule-summary">{isParticipantMode ? (enrollmentsByParticipant.get(person.id) ?? []).map((enrollment) => `${enrollment.course_code} · ${enrollment.billing_type === "private" ? `${enrollment.credit_lessons ?? 0} Lektionen` : "Kostenträger"}`).join(" · ") || "Noch in keinem Kurs" : (coursesByTeacher.get(person.id) ?? []).map((course) => `${course.code} · ${course.language} ${course.level}`).join(" · ") || "Noch keinem Kurs zugeordnet"}</p><button className="quiet-button" onClick={() => setEditingPerson(person)} type="button">Stammdaten bearbeiten</button></article>)}</div>}
    {personDialogOpen ? <div className="dialog-backdrop" role="presentation"><form action={createPerson} className="attendance-dialog" aria-labelledby="create-person-title"><button aria-label="Personenformular schliessen" className="dialog-close" onClick={() => setPersonDialogOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-person-title">{isParticipantMode ? "Teilnehmer anlegen" : "Lehrperson anlegen"}</h2><div className="form-grid"><label>Name<input name="name" required /></label><label>E-Mail<input name="email" required type="email" /></label><label>Telefon<input name="phone" /></label><label>Strasse<input name="street" /></label><label>PLZ<input name="postalCode" /></label><label>Ort<input name="city" /></label>{!isParticipantMode ? <><label>Lehrpersonenkürzel<input name="teacherCode" /></label><label>Tarif pro Lektion<input min="0" name="ratePerLesson" step="0.05" type="number" /></label></> : null}<label className="form-grid__full">Notizen<textarea name="notes" rows={3} /></label><label>Startpasswort<input minLength={12} name="password" required type="password" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setPersonDialogOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isCreating} type="submit">{isCreating ? "Wird angelegt …" : "Zugang anlegen"}</button></div></form></div> : null}
    {editingPerson ? <div className="dialog-backdrop" role="presentation"><form action={updatePerson} className="attendance-dialog" aria-labelledby="edit-person-title"><button aria-label="Bearbeitung schliessen" className="dialog-close" onClick={() => setEditingPerson(null)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="edit-person-title">{editingPerson.name} bearbeiten</h2><div className="form-grid"><label>Name<input defaultValue={editingPerson.name} name="name" required /></label><label>E-Mail<input defaultValue={editingPerson.email} name="email" required type="email" /></label><label>Telefon<input defaultValue={editingPerson.phone ?? ""} name="phone" /></label><label>Strasse<input defaultValue={editingPerson.street ?? ""} name="street" /></label><label>PLZ<input defaultValue={editingPerson.postal_code ?? ""} name="postalCode" /></label><label>Ort<input defaultValue={editingPerson.city ?? ""} name="city" /></label>{!isParticipantMode ? <><label>Lehrpersonenkürzel<input defaultValue={editingPerson.teacher_code ?? ""} name="teacherCode" /></label><label>Tarif pro Lektion<input defaultValue={editingPerson.rate_per_lesson ?? ""} min="0" name="ratePerLesson" step="0.05" type="number" /></label></> : null}<label className="form-grid__full">Notizen<textarea defaultValue={editingPerson.notes ?? ""} name="notes" rows={4} /></label></div>{editingPerson.history?.length ? <div className="history-list"><strong>Änderungshistorie</strong>{editingPerson.history.slice(0, 8).map((event, index) => <p key={`${event.occurredAt}-${index}`}><b>{event.summary}</b><span>{new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt))}</span></p>)}</div> : <p className="planner-state">Noch keine Änderungen protokolliert.</p>}<div className="dialog-actions"><button className="quiet-button" onClick={() => setEditingPerson(null)} type="button">Abbrechen</button><button className="primary-button" disabled={isCreating} type="submit">{isCreating ? "Wird gespeichert …" : "Daten speichern"}</button></div></form></div> : null}
    {isParticipantMode && enrollmentDialogOpen ? <div className="dialog-backdrop" role="presentation"><form action={createEnrollment} className="attendance-dialog" aria-labelledby="create-enrollment-title"><button aria-label="Einschreibungsformular schliessen" className="dialog-close" onClick={() => setEnrollmentDialogOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-enrollment-title">In Kurs einschreiben</h2><div className="form-grid"><label>Teilnehmer<select defaultValue="" name="participantId" required><option disabled value="">Bitte wählen</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Kurs<select defaultValue="" name="courseId" required><option disabled value="">Bitte wählen</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.language} {course.level}</option>)}</select></label><label>Abrechnung<select defaultValue="private" name="billingType"><option value="private">Privat</option><option value="authority">Kostenträger</option></select></label><label>Lektionsguthaben<input defaultValue="14" min="0" name="creditLessons" required type="number" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setEnrollmentDialogOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isEnrolling || people.length === 0 || courses.length === 0} type="submit">{isEnrolling ? "Wird eingeschrieben …" : "Einschreiben"}</button></div></form></div> : null}
  </section>;
}
