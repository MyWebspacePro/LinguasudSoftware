"use client";

import { useEffect, useMemo, useState } from "react";

type PersonRole = "office" | "teacher" | "participant";
type Person = { id: string; name: string; email: string; role: PersonRole };
type Course = { id: string; code: string; language: string; level: string; teacher_name: string };
type Enrollment = { id: string; participant_id: string; course_id: string; billing_type: "private" | "authority"; credit_lessons: number | null; active: boolean; course_code: string; course_language: string; course_level: string };

function errorMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

export function PeopleWorkspace() {
  const [people, setPeople] = useState<Person[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const [peopleResponse, coursesResponse, enrollmentsResponse] = await Promise.all([
        fetch("/api/users", { credentials: "same-origin" }),
        fetch("/api/courses", { credentials: "same-origin" }),
        fetch("/api/enrollments", { credentials: "same-origin" }),
      ]);
      const [peoplePayload, coursesPayload, enrollmentsPayload] = await Promise.all([peopleResponse.json(), coursesResponse.json(), enrollmentsResponse.json()]);
      if (!peopleResponse.ok) throw new Error(errorMessage(peoplePayload, "Personen konnten nicht geladen werden."));
      if (!coursesResponse.ok) throw new Error(errorMessage(coursesPayload, "Kurse konnten nicht geladen werden."));
      if (!enrollmentsResponse.ok) throw new Error(errorMessage(enrollmentsPayload, "Einschreibungen konnten nicht geladen werden."));
      setPeople((peoplePayload as { users: Person[] }).users);
      setCourses((coursesPayload as { courses: Course[] }).courses);
      setEnrollments((enrollmentsPayload as { enrollments: Enrollment[] }).enrollments);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Personen konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { queueMicrotask(() => void load()); }, []);

  const participants = useMemo(() => people.filter((person) => person.role === "participant"), [people]);
  const teachers = useMemo(() => people.filter((person) => person.role === "teacher"), [people]);
  const enrollmentsByParticipant = useMemo(() => {
    const map = new Map<string, Enrollment[]>();
    enrollments.forEach((enrollment) => map.set(enrollment.participant_id, [...(map.get(enrollment.participant_id) ?? []), enrollment]));
    return map;
  }, [enrollments]);

  async function createPerson(formData: FormData) {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/users", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), role: formData.get("role") }),
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
    <div className="preview-intro"><p className="eyebrow">Personen & Teilnahmen</p><h2 id="people-title">Teilnehmende <span>{participants.length}</span></h2><p>Lehrpersonen und Teilnehmende erhalten eigene Zugänge. Einschreibungen und Lektionenguthaben werden durch das Büro geführt.</p><div className="workspace-actions"><button className="primary-button" onClick={() => setPersonDialogOpen(true)} type="button">+ Person anlegen</button><button className="quiet-button" onClick={() => setEnrollmentDialogOpen(true)} type="button">+ In Kurs einschreiben</button></div></div>
    {error ? <p className="planner-state" role="alert">{error}</p> : null}
    {isLoading ? <p className="planner-state">Personen werden geladen …</p> : <><div className="people-summary"><span>{teachers.length} Lehrpersonen</span><span>{participants.length} Teilnehmende</span></div><div className="preview-grid">{participants.length === 0 ? <p className="planner-state">Noch keine Teilnehmenden angelegt.</p> : participants.map((person) => <article key={person.id}><span>Teilnehmer:in</span><h3>{person.name}</h3><p>{person.email}</p><p className="course-schedule-summary">{(enrollmentsByParticipant.get(person.id) ?? []).map((enrollment) => `${enrollment.course_code} · ${enrollment.billing_type === "private" ? `${enrollment.credit_lessons ?? 0} Lektionen` : "Kostenträger"}`).join(" · ") || "Noch in keinem Kurs"}</p></article>)}</div></>}
    {personDialogOpen ? <div className="dialog-backdrop" role="presentation"><form action={createPerson} className="attendance-dialog" aria-labelledby="create-person-title"><button aria-label="Personenformular schliessen" className="dialog-close" onClick={() => setPersonDialogOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-person-title">Person anlegen</h2><div className="form-grid"><label>Name<input name="name" required /></label><label>E-Mail<input name="email" required type="email" /></label><label>Rolle<select defaultValue="participant" name="role"><option value="participant">Teilnehmer:in</option><option value="teacher">Lehrperson</option><option value="office">Büro</option></select></label><label>Startpasswort<input minLength={12} name="password" required type="password" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setPersonDialogOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isCreating} type="submit">{isCreating ? "Wird angelegt …" : "Zugang anlegen"}</button></div></form></div> : null}
    {enrollmentDialogOpen ? <div className="dialog-backdrop" role="presentation"><form action={createEnrollment} className="attendance-dialog" aria-labelledby="create-enrollment-title"><button aria-label="Einschreibungsformular schliessen" className="dialog-close" onClick={() => setEnrollmentDialogOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-enrollment-title">In Kurs einschreiben</h2><div className="form-grid"><label>Teilnehmer:in<select defaultValue="" name="participantId" required><option disabled value="">Bitte wählen</option>{participants.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Kurs<select defaultValue="" name="courseId" required><option disabled value="">Bitte wählen</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.language} {course.level}</option>)}</select></label><label>Abrechnung<select defaultValue="private" name="billingType"><option value="private">Privat</option><option value="authority">Kostenträger</option></select></label><label>Lektionsguthaben<input defaultValue="14" min="0" name="creditLessons" required type="number" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setEnrollmentDialogOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isEnrolling || participants.length === 0 || courses.length === 0} type="submit">{isEnrolling ? "Wird eingeschrieben …" : "Einschreiben"}</button></div></form></div> : null}
  </section>;
}
