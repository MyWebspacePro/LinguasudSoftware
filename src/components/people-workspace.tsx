"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PersonRole = "office" | "teacher" | "participant";
type TeachingLevel = { language: string; levels: string[]; fromLevel?: string; toLevel?: string };
type QualificationRow = { language: string; fromLevel: string; toLevel: string };
type PersonNote = { id: string; body: string; createdAt: string; createdBy?: string | null };
type Person = { id: string; name: string; email: string; role: PersonRole; salutation?: string | null; first_name?: string | null; last_name?: string | null; gender?: string | null; phone?: string | null; street?: string | null; postal_code?: string | null; city?: string | null; preferred_contact?: "email" | "phone" | "postal" | null; email_reminders?: boolean; language_preference?: string | null; notes?: string | null; notes_history?: PersonNote[]; teacher_code?: string | null; rate_per_lesson?: number | null; teaching_levels?: TeachingLevel[]; courses?: Array<{ id: string; code: string; language: string; level: string; status: string; standardRoomId: string | null }>; course_count?: number; history?: Array<{ eventType: string; summary: string; occurredAt: string }> };
type Course = { id: string; code: string; language: string; level: string; teacher_id: string; teacher_name: string };
type AttendanceSummary = { present: number; excused: number; unexcused: number; online: number; trial: number };
type EnrollmentPause = { id: string; startsOn: string; endsOn: string | null; reason: string | null };
type Enrollment = { id: string; participant_id: string; course_id: string; billing_type: "private" | "authority"; credit_lessons: number | null; payment_status?: "open" | "partially_paid" | "paid" | "overdue"; purchased_amount?: number | null; payer_name?: string | null; case_reference?: string | null; approved_lessons?: number | null; approved_amount?: number | null; valid_from?: string | null; valid_until?: string | null; tariff?: number | null; invoice_recipient?: string | null; active: boolean; course_code: string; course_language: string; course_level: string; attendance_summary?: AttendanceSummary; pauses?: EnrollmentPause[] };

function errorMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

const levelOptions = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
const languageOptions = ["Deutsch", "Englisch", "Französisch", "Italienisch", "Spanisch", "Portugiesisch", "Arabisch", "Albanisch", "Chinesisch", "Japanisch", "Koreanisch", "Türkisch", "Russisch", "Serbisch", "Ukrainisch"];
const salutationOptions = [{ value: "frau", label: "Frau" }, { value: "herr", label: "Herr" }, { value: "divers", label: "Divers" }, { value: "keine_angabe", label: "Keine Angabe" }];
const genderOptions = [{ value: "weiblich", label: "Weiblich" }, { value: "männlich", label: "Männlich" }, { value: "divers", label: "Divers" }, { value: "keine_angabe", label: "Keine Angabe" }];

function parseQualificationRows(value: FormDataEntryValue | null): QualificationRow[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QualificationRow => typeof item === "object" && item !== null && typeof (item as QualificationRow).language === "string" && (item as QualificationRow).language.trim().length >= 2 && levelOptions.includes((item as QualificationRow).fromLevel) && levelOptions.includes((item as QualificationRow).toLevel));
  } catch { return []; }
}

function rowsFromTeachingLevels(value: TeachingLevel[] | undefined): QualificationRow[] {
  const rows = (value ?? []).map((item) => {
    const levels = item.levels ?? [];
    return { language: item.language, fromLevel: item.fromLevel ?? levels[0] ?? "A0", toLevel: item.toLevel ?? levels.at(-1) ?? levels[0] ?? "A0" };
  }).filter((row) => row.language && levelOptions.includes(row.fromLevel) && levelOptions.includes(row.toLevel));
  return rows.length ? rows : [{ language: "", fromLevel: "A0", toLevel: "A0" }];
}

function parseNotes(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : []; } catch { return []; }
}

function IdentityFields({ person }: { person?: Person }) {
  return <>
    <label>Anrede<select defaultValue={person?.salutation ?? "keine_angabe"} name="salutation"><option value="frau">Frau</option><option value="herr">Herr</option><option value="divers">Divers</option><option value="keine_angabe">Keine Angabe</option></select></label>
    <label>Vorname<input defaultValue={person?.first_name ?? ""} name="firstName" required /></label>
    <label>Nachname<input defaultValue={person?.last_name ?? ""} name="lastName" required /></label>
    <label>Geschlecht<select defaultValue={person?.gender ?? "keine_angabe"} name="gender">{genderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
  </>;
}

function TeachingLevelFields({ rows, onChange }: { rows: QualificationRow[]; onChange: (rows: QualificationRow[]) => void }) {
  function update(index: number, field: keyof QualificationRow, value: string) {
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }
  return <div className="form-grid__full qualification-fields"><span className="field-label">Unterrichtete Sprachen und Niveaus</span>{rows.map((row, index) => <div className="qualification-row" key={index}>
    <label>{index + 1}. Sprache<select aria-label={`${index + 1}. Sprache`} name={`qualification-language-${index}`} onChange={(event) => update(index, "language", event.target.value)} required value={row.language}><option disabled value="">Bitte wählen</option>{row.language && !languageOptions.includes(row.language) ? <option value={row.language}>{row.language}</option> : null}{languageOptions.map((language) => <option key={language} value={language}>{language}</option>)}</select></label>
    <label>Niveau von<select aria-label={`${index + 1}. Niveau von`} name={`qualification-from-${index}`} onChange={(event) => update(index, "fromLevel", event.target.value)} value={row.fromLevel}>{levelOptions.map((level) => <option key={level}>{level}</option>)}</select></label>
    <label>Niveau bis<select aria-label={`${index + 1}. Niveau bis`} name={`qualification-to-${index}`} onChange={(event) => update(index, "toLevel", event.target.value)} value={row.toLevel}>{levelOptions.map((level) => <option key={level}>{level}</option>)}</select></label>
    {rows.length > 1 ? <button aria-label={`${index + 1}. Sprache entfernen`} className="quiet-button qualification-remove" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} type="button">Entfernen</button> : null}
  </div>)}<input name="teachingLevelsJson" type="hidden" value={JSON.stringify(rows)} /><button className="quiet-button qualification-add" onClick={() => onChange([...rows, { language: "", fromLevel: "A0", toLevel: "A0" }])} type="button">+ Sprache hinzufügen</button><small>Pro Sprache wird ein Bereich von/bis A0–C2 gespeichert.</small></div>;
}

function NotesFields({ drafts, onChange, existing }: { drafts: string[]; onChange: (drafts: string[]) => void; existing?: PersonNote[] }) {
  return <div className="form-grid__full notes-fields"><span className="field-label">Notizen</span>{existing?.length ? <div className="notes-history">{existing.map((note) => <div className="note-entry" key={note.id}><p>{note.body}</p><small>{new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.createdAt))}{note.createdBy ? ` · ${note.createdBy}` : ""}</small></div>)}</div> : null}{drafts.map((draft, index) => <textarea aria-label={`Neue Notiz ${index + 1}`} key={index} onChange={(event) => onChange(drafts.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="Neue Notiz erfassen …" rows={3} value={draft} />)}<input name="notesJson" type="hidden" value={JSON.stringify(drafts.filter((draft) => draft.trim()))} /><button className="quiet-button qualification-add" onClick={() => onChange([...drafts, ""])} type="button">+ Notiz hinzufügen</button></div>;
}

const participantDateFormatter = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });

function formatParticipantDate(value: string | null) {
  return value ? participantDateFormatter.format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "offen";
}

function attendanceText(summary: AttendanceSummary | undefined) {
  const current = summary ?? { present: 0, excused: 0, unexcused: 0, online: 0, trial: 0 };
  const parts = [`${current.present} anwesend`, `${current.excused} entschuldigt`, `${current.unexcused} unentschuldigt`];
  if (current.online > 0) parts.push(`${current.online} online`);
  if (current.trial > 0) parts.push(`${current.trial} Probelektion`);
  return parts.join(" · ");
}

function ParticipantEnrollmentList({
  enrollments,
  onOpenCourse,
  onEditBilling,
  onAddPause,
  onRemovePause,
}: {
  enrollments: Enrollment[];
  onOpenCourse?: (courseId: string) => void;
  onEditBilling: (enrollment: Enrollment) => void;
  onAddPause: (enrollment: Enrollment) => void;
  onRemovePause: (enrollment: Enrollment, pause: EnrollmentPause) => void;
}) {
  return <div className="participant-enrollments">{enrollments.length ? enrollments.map((enrollment) => <div className={`enrollment-row${enrollment.active ? "" : " is-ended"}`} key={enrollment.id}>
    <div className="enrollment-row__main">
      <div className="enrollment-row__course"><button className="course-link" onClick={() => onOpenCourse?.(enrollment.course_id)} type="button">{enrollment.course_code}</button><span>{enrollment.billing_type === "private" ? `${enrollment.credit_lessons ?? 0} Lektionen` : "Kostenträger"}{enrollment.payment_status ? ` · ${enrollment.payment_status}` : ""}{!enrollment.active ? " · beendet" : ""}</span></div>
      <span className="attendance-summary"><b>Anwesenheit</b> {attendanceText(enrollment.attendance_summary)}</span>
      {enrollment.pauses?.length ? <div className="enrollment-pauses"><b>Pausen</b>{enrollment.pauses.map((pause) => <span className="pause-chip" key={pause.id}>{formatParticipantDate(pause.startsOn)}–{formatParticipantDate(pause.endsOn)}{pause.reason ? ` · ${pause.reason}` : ""}<button aria-label={`Pause vom ${formatParticipantDate(pause.startsOn)} entfernen`} onClick={() => onRemovePause(enrollment, pause)} type="button">×</button></span>)}</div> : null}
    </div>
    <div className="enrollment-row__actions">{enrollment.active ? <button className="inline-edit-button" onClick={() => onAddPause(enrollment)} type="button">Pause erfassen</button> : null}<button className="inline-edit-button" onClick={() => onEditBilling(enrollment)} type="button">Abrechnung</button></div>
  </div>) : "Noch in keinem Kurs"}</div>;
}

export function PeopleWorkspace({ mode, onOpenCourse }: { mode: "participants" | "teachers"; onOpenCourse?: (courseId: string) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [enrollmentDialogOpen, setEnrollmentDialogOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [pauseEnrollment, setPauseEnrollment] = useState<Enrollment | null>(null);
  const [qualificationRows, setQualificationRows] = useState<QualificationRow[]>([{ language: "", fromLevel: "A0", toLevel: "A0" }]);
  const [noteDrafts, setNoteDrafts] = useState<string[]>([""]);
  const [isEnrollmentSaving, setIsEnrollmentSaving] = useState(false);
  const [isPauseSaving, setIsPauseSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isParticipantMode = mode === "participants";
  const role: PersonRole = isParticipantMode ? "participant" : "teacher";
  const title = isParticipantMode ? "Teilnehmer" : "Lehrpersonen";

  function openCreatePerson() {
    setEditingPerson(null);
    setQualificationRows([{ language: "", fromLevel: "A0", toLevel: "A0" }]);
    setNoteDrafts([""]);
    setPersonDialogOpen(true);
  }

  function openEditPerson(person: Person) {
    setPersonDialogOpen(false);
    setEditingPerson(person);
    setQualificationRows(rowsFromTeachingLevels(person.teaching_levels));
    setNoteDrafts([""]);
  }

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
        body: JSON.stringify({ salutation: formData.get("salutation"), firstName: formData.get("firstName"), lastName: formData.get("lastName"), gender: formData.get("gender"), email: formData.get("email"), password: formData.get("password"), phone: formData.get("phone") || null, street: formData.get("street") || null, postalCode: formData.get("postalCode") || null, city: formData.get("city") || null, preferredContact: isParticipantMode ? formData.get("preferredContact") : undefined, emailReminders: isParticipantMode ? formData.get("emailReminders") === "on" : undefined, languagePreference: isParticipantMode ? formData.get("languagePreference") || null : undefined, teacherCode: isParticipantMode ? undefined : formData.get("teacherCode") || null, teachingLevels: isParticipantMode ? undefined : parseQualificationRows(formData.get("teachingLevelsJson")), ratePerLesson: isParticipantMode ? undefined : (formData.get("ratePerLesson") ? Number(formData.get("ratePerLesson")) : null), notes: parseNotes(formData.get("notesJson")) }),
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
      const response = await fetch(`/api/${role === "participant" ? "participants" : "teachers"}/${editingPerson.id}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ salutation: formData.get("salutation"), firstName: formData.get("firstName"), lastName: formData.get("lastName"), gender: formData.get("gender"), email: formData.get("email"), phone: formData.get("phone") || null, street: formData.get("street") || null, postalCode: formData.get("postalCode") || null, city: formData.get("city") || null, preferredContact: isParticipantMode ? formData.get("preferredContact") : undefined, emailReminders: isParticipantMode ? formData.get("emailReminders") === "on" : undefined, languagePreference: isParticipantMode ? formData.get("languagePreference") || null : undefined, teacherCode: isParticipantMode ? undefined : formData.get("teacherCode") || null, teachingLevels: isParticipantMode ? undefined : parseQualificationRows(formData.get("teachingLevelsJson")), ratePerLesson: isParticipantMode ? undefined : (formData.get("ratePerLesson") ? Number(formData.get("ratePerLesson")) : null), notes: parseNotes(formData.get("notesJson")) }) });
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

  async function updateEnrollment(formData: FormData) {
    if (!editingEnrollment) return;
    setIsEnrollmentSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/enrollments/${editingEnrollment.id}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingType: formData.get("billingType"),
          creditLessons: formData.get("creditLessons") === "" ? null : Number(formData.get("creditLessons")),
          paymentStatus: formData.get("paymentStatus"),
          purchasedAmount: formData.get("purchasedAmount") === "" ? null : Number(formData.get("purchasedAmount")),
          payerName: formData.get("payerName") || null,
          caseReference: formData.get("caseReference") || null,
          approvedLessons: formData.get("approvedLessons") === "" ? null : Number(formData.get("approvedLessons")),
          approvedAmount: formData.get("approvedAmount") === "" ? null : Number(formData.get("approvedAmount")),
          validFrom: formData.get("validFrom") || null,
          validUntil: formData.get("validUntil") || null,
          tariff: formData.get("tariff") === "" ? null : Number(formData.get("tariff")),
          invoiceRecipient: formData.get("invoiceRecipient") || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Abrechnungsdaten konnten nicht gespeichert werden."));
      setEditingEnrollment(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Abrechnungsdaten konnten nicht gespeichert werden.");
    } finally {
      setIsEnrollmentSaving(false);
    }
  }

  async function createPause(formData: FormData) {
    if (!pauseEnrollment) return;
    setIsPauseSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/enrollments/${pauseEnrollment.id}/pauses`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsOn: formData.get("startsOn"),
          endsOn: formData.get("endsOn") || null,
          reason: formData.get("reason") || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Pause konnte nicht gespeichert werden."));
      setPauseEnrollment(null);
      await load();
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : "Pause konnte nicht gespeichert werden.");
    } finally {
      setIsPauseSaving(false);
    }
  }

  async function removePause(enrollment: Enrollment, pause: EnrollmentPause) {
    if (!window.confirm(`Pause vom ${formatParticipantDate(pause.startsOn)} für ${enrollment.course_code} entfernen?`)) return;
    setIsPauseSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/enrollments/${enrollment.id}/pauses`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauseId: pause.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Pause konnte nicht entfernt werden."));
      await load();
    } catch (pauseError) {
      setError(pauseError instanceof Error ? pauseError.message : "Pause konnte nicht entfernt werden.");
    } finally {
      setIsPauseSaving(false);
    }
  }

  return <section className="management-preview" aria-labelledby="people-title">
    <div className="preview-intro"><p className="eyebrow">{isParticipantMode ? "Teilnahmen & Guthaben" : "Kurszuordnung"}</p><h2 id="people-title">{title} <span>{people.length}</span></h2><p>{isParticipantMode ? "Teilnehmerzugänge, Kurszuordnungen und Guthaben werden vom Büro geführt." : "Lehrpersonen erhalten einen eigenen Zugang und sehen ausschliesslich ihre eigenen Lektionen."}</p><div className="workspace-actions"><button className="primary-button" onClick={openCreatePerson} type="button">+ {isParticipantMode ? "Teilnehmer anlegen" : "Lehrperson anlegen"}</button>{isParticipantMode ? <button className="quiet-button" onClick={() => setEnrollmentDialogOpen(true)} type="button">+ In Kurs einschreiben</button> : null}</div></div>
    {error ? <p className="planner-state" role="alert">{error}</p> : null}
    {isLoading ? <p className="planner-state">{title} werden geladen …</p> : <div className="preview-grid">{people.length === 0 ? <p className="planner-state">Noch keine {isParticipantMode ? "Teilnehmer" : "Lehrpersonen"} angelegt.</p> : people.map((person) => <article key={person.id}><span>{isParticipantMode ? "Teilnehmer" : "Lehrperson"}</span><h3>{[person.salutation && salutationOptions.find((option) => option.value === person.salutation)?.label, person.first_name, person.last_name].filter(Boolean).join(" ") || person.name}</h3><p>{person.email}</p>{isParticipantMode ? <ParticipantEnrollmentList enrollments={enrollmentsByParticipant.get(person.id) ?? []} onAddPause={(enrollment) => setPauseEnrollment(enrollment)} onEditBilling={(enrollment) => setEditingEnrollment(enrollment)} onOpenCourse={onOpenCourse} onRemovePause={(enrollment, pause) => void removePause(enrollment, pause)} /> : <p className="course-schedule-summary">{(coursesByTeacher.get(person.id) ?? []).map((course) => `${course.code} · ${course.language} ${course.level}`).join(" · ") || "Noch keinem Kurs zugeordnet"}{person.teaching_levels?.length ? <><br />Unterrichtet: {person.teaching_levels.map((item) => `${item.language} ${item.fromLevel ?? item.levels[0] ?? "A0"}–${item.toLevel ?? item.levels.at(-1) ?? item.levels[0] ?? "A0"}`).join(" · ")}</> : null}</p>}<button className="quiet-button" onClick={() => openEditPerson(person)} type="button">Stammdaten bearbeiten</button></article>)}</div>}
    {personDialogOpen ? <div className="dialog-backdrop" role="presentation"><form action={createPerson} className="attendance-dialog" aria-labelledby="create-person-title"><button aria-label="Personenformular schliessen" className="dialog-close" onClick={() => setPersonDialogOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-person-title">{isParticipantMode ? "Teilnehmer anlegen" : "Lehrperson anlegen"}</h2><div className="form-grid"><IdentityFields /><label>E-Mail<input name="email" required type="email" /></label><label>Telefon<input name="phone" /></label><label>Strasse<input name="street" /></label><label>PLZ<input name="postalCode" /></label><label>Ort<input name="city" /></label>{isParticipantMode ? <><label>Bevorzugter Kontakt<select defaultValue="email" name="preferredContact"><option value="email">E-Mail</option><option value="phone">Telefon</option><option value="postal">Post</option></select></label><label>Bevorzugte Sprache<input name="languagePreference" placeholder="z. B. Deutsch" /></label><label className="checkbox-field"><input name="emailReminders" type="checkbox" />E-Mail-Erinnerungen erlauben</label></> : <><label>Lehrpersonenkürzel<input name="teacherCode" /></label><label>Tarif pro Lektion<input min="0" name="ratePerLesson" step="0.05" type="number" /></label><TeachingLevelFields onChange={setQualificationRows} rows={qualificationRows} /></>}<NotesFields drafts={noteDrafts} existing={[]} onChange={setNoteDrafts} /><label>Startpasswort<input minLength={12} name="password" required type="password" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setPersonDialogOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isCreating} type="submit">{isCreating ? "Wird angelegt …" : "Zugang anlegen"}</button></div></form></div> : null}
    {editingPerson ? <div className="dialog-backdrop" role="presentation"><form action={updatePerson} className="attendance-dialog" aria-labelledby="edit-person-title"><button aria-label="Bearbeitung schliessen" className="dialog-close" onClick={() => setEditingPerson(null)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="edit-person-title">{editingPerson.name} bearbeiten</h2><div className="form-grid"><IdentityFields person={editingPerson} /><label>E-Mail<input defaultValue={editingPerson.email} name="email" required type="email" /></label><label>Telefon<input defaultValue={editingPerson.phone ?? ""} name="phone" /></label><label>Strasse<input defaultValue={editingPerson.street ?? ""} name="street" /></label><label>PLZ<input defaultValue={editingPerson.postal_code ?? ""} name="postalCode" /></label><label>Ort<input defaultValue={editingPerson.city ?? ""} name="city" /></label>{isParticipantMode ? <><label>Bevorzugter Kontakt<select defaultValue={editingPerson.preferred_contact ?? "email"} name="preferredContact"><option value="email">E-Mail</option><option value="phone">Telefon</option><option value="postal">Post</option></select></label><label>Bevorzugte Sprache<input defaultValue={editingPerson.language_preference ?? ""} name="languagePreference" /></label><label className="checkbox-field"><input defaultChecked={editingPerson.email_reminders ?? false} name="emailReminders" type="checkbox" />E-Mail-Erinnerungen erlauben</label></> : <><label>Lehrpersonenkürzel<input defaultValue={editingPerson.teacher_code ?? ""} name="teacherCode" /></label><label>Tarif pro Lektion<input defaultValue={editingPerson.rate_per_lesson ?? ""} min="0" name="ratePerLesson" step="0.05" type="number" /></label><TeachingLevelFields onChange={setQualificationRows} rows={qualificationRows} /></>}<NotesFields drafts={noteDrafts} existing={editingPerson.notes_history ?? []} onChange={setNoteDrafts} /></div>{editingPerson.history?.length ? <div className="history-list"><strong>Änderungshistorie</strong>{editingPerson.history.slice(0, 8).map((event, index) => <p key={`${event.occurredAt}-${index}`}><b>{event.summary}</b><span>{new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt))}</span></p>)}</div> : <p className="planner-state">Noch keine Änderungen protokolliert.</p>}<div className="dialog-actions"><button className="quiet-button" onClick={() => setEditingPerson(null)} type="button">Abbrechen</button><button className="primary-button" disabled={isCreating} type="submit">{isCreating ? "Wird gespeichert …" : "Daten speichern"}</button></div></form></div> : null}
    {isParticipantMode && enrollmentDialogOpen ? <div className="dialog-backdrop" role="presentation"><form action={createEnrollment} className="attendance-dialog" aria-labelledby="create-enrollment-title"><button aria-label="Einschreibungsformular schliessen" className="dialog-close" onClick={() => setEnrollmentDialogOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-enrollment-title">In Kurs einschreiben</h2><div className="form-grid"><label>Teilnehmer<select defaultValue="" name="participantId" required><option disabled value="">Bitte wählen</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Kurs<select defaultValue="" name="courseId" required><option disabled value="">Bitte wählen</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.language} {course.level}</option>)}</select></label><label>Abrechnung<select defaultValue="private" name="billingType"><option value="private">Privat</option><option value="authority">Kostenträger</option></select></label><label>Lektionsguthaben<input defaultValue="14" min="0" name="creditLessons" required type="number" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setEnrollmentDialogOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isEnrolling || people.length === 0 || courses.length === 0} type="submit">{isEnrolling ? "Wird eingeschrieben …" : "Einschreiben"}</button></div></form></div> : null}
    {editingEnrollment ? <div className="dialog-backdrop" role="presentation"><form action={updateEnrollment} className="attendance-dialog" aria-labelledby="edit-enrollment-title"><button aria-label="Abrechnung schliessen" className="dialog-close" onClick={() => setEditingEnrollment(null)} type="button">×</button><p className="eyebrow">Teilnahme</p><h2 id="edit-enrollment-title">{editingEnrollment.course_code} · Abrechnung</h2><div className="form-grid"><label>Abrechnung<select defaultValue={editingEnrollment.billing_type} name="billingType"><option value="private">Privat</option><option value="authority">Kostenträger</option></select></label><label>Zahlungsstatus<select defaultValue={editingEnrollment.payment_status ?? "open"} name="paymentStatus"><option value="open">Offen</option><option value="partially_paid">Teilweise bezahlt</option><option value="paid">Bezahlt</option><option value="overdue">Überfällig</option></select></label><label>Lektionsguthaben<input defaultValue={editingEnrollment.credit_lessons ?? ""} min="0" name="creditLessons" type="number" /></label><label>Gekaufter Betrag (CHF)<input defaultValue={editingEnrollment.purchased_amount ?? ""} min="0" name="purchasedAmount" step="0.05" type="number" /></label><label>Zahlende Person / Stelle<input defaultValue={editingEnrollment.payer_name ?? ""} name="payerName" /></label><label>Fall-/Referenznummer<input defaultValue={editingEnrollment.case_reference ?? ""} name="caseReference" /></label><label>Bewilligte Lektionen<input defaultValue={editingEnrollment.approved_lessons ?? ""} min="0" name="approvedLessons" type="number" /></label><label>Bewilligter Betrag (CHF)<input defaultValue={editingEnrollment.approved_amount ?? ""} min="0" name="approvedAmount" step="0.05" type="number" /></label><label>Gültig von<input defaultValue={editingEnrollment.valid_from ?? ""} name="validFrom" type="date" /></label><label>Gültig bis<input defaultValue={editingEnrollment.valid_until ?? ""} name="validUntil" type="date" /></label><label>Tarif pro Lektion (CHF)<input defaultValue={editingEnrollment.tariff ?? ""} min="0" name="tariff" step="0.05" type="number" /></label><label>Rechnungsempfänger<input defaultValue={editingEnrollment.invoice_recipient ?? ""} name="invoiceRecipient" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setEditingEnrollment(null)} type="button">Abbrechen</button><button className="primary-button" disabled={isEnrollmentSaving} type="submit">{isEnrollmentSaving ? "Wird gespeichert …" : "Abrechnung speichern"}</button></div></form></div> : null}
    {pauseEnrollment ? <div className="dialog-backdrop" role="presentation"><form action={createPause} className="attendance-dialog" aria-labelledby="create-pause-title"><button aria-label="Pausenformular schliessen" className="dialog-close" onClick={() => setPauseEnrollment(null)} type="button">×</button><p className="eyebrow">Teilnehmerverwaltung</p><h2 id="create-pause-title">Pause für {pauseEnrollment.course_code}</h2><p className="dialog-course">{pauseEnrollment.course_language} {pauseEnrollment.course_level}</p><div className="form-grid"><label>Pause von<input defaultValue={new Date().toISOString().slice(0, 10)} name="startsOn" required type="date" /></label><label>Pause bis<input name="endsOn" type="date" /></label><label className="form-grid__full">Grund / Hinweis<textarea name="reason" placeholder="z. B. Ferien, längere Abwesenheit" rows={3} /></label></div><p className="form-hint">Die offenen Lektionen bleiben bestehen und können nach der Pause bezogen werden.</p><div className="dialog-actions"><button className="quiet-button" onClick={() => setPauseEnrollment(null)} type="button">Abbrechen</button><button className="primary-button" disabled={isPauseSaving} type="submit">{isPauseSaving ? "Wird gespeichert …" : "Pause speichern"}</button></div></form></div> : null}
  </section>;
}
