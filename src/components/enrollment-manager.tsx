"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { BILLING_TYPES, ENROLLMENT_STATUSES } from "@/lib/types";
import type { BillingType, Course, Enrollment, EnrollmentStatus, Organization, Person } from "@/lib/types";

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  interested: "Interessent",
  trial: "Probelektion",
  active: "Aktiv",
  inactive: "Inaktiv",
};

const BILLING_LABELS: Record<BillingType, string> = {
  private: "Selbstzahler",
  company: "Firma",
  authority: "Behörde",
};

export function EnrollmentManager({
  initialEnrollments,
  courses,
  participants,
  organizations,
}: {
  initialEnrollments: Enrollment[];
  courses: Course[];
  participants: Person[];
  organizations: Organization[];
}) {
  const [items, setItems] = useState(() => initialEnrollments);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [courseFilter, setCourseFilter] = useState("");

  const [createForm, setCreateForm] = useState(() => ({
    courseId: courses[0]?.id ?? "",
    participantId: participants[0]?.id ?? "",
    status: "active" as EnrollmentStatus,
    billingType: "private" as BillingType,
    organizationId: "",
    agreedLessons: "",
    agreedPriceChf: "",
    startedOn: new Date().toISOString().slice(0, 10),
    endedOn: "",
  }));

  const [creditForm, setCreditForm] = useState({ enrollmentId: "", delta: "", reason: "" });

  const canCreate = courses.length > 0 && participants.length > 0;

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const { enrollment } = await api.post<{ enrollment: Enrollment }>("/api/enrollments", {
        courseId: createForm.courseId,
        participantId: createForm.participantId,
        status: createForm.status,
        billingType: createForm.billingType,
        organizationId: createForm.organizationId || null,
        agreedLessons: createForm.agreedLessons ? Number(createForm.agreedLessons) : null,
        agreedPriceChf: createForm.agreedPriceChf ? Number(createForm.agreedPriceChf) : null,
        startedOn: createForm.startedOn || null,
        endedOn: createForm.endedOn || null,
      });
      setItems((current) => [...current, enrollment]);
      setNotice(`Anmeldung «${enrollment.participantName}» für «${enrollment.courseCode}» angelegt (Guthaben ${enrollment.creditLessons}).`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function submitCredit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!creditForm.enrollmentId || !creditForm.delta) {
      setError("Bitte Anmeldung und Delta angeben.");
      return;
    }
    setSaving(true);
    try {
      const { enrollment } = await api.post<{ enrollment: Enrollment }>(
        `/api/enrollments/${creditForm.enrollmentId}/credits`,
        { delta: Number(creditForm.delta), reason: creditForm.reason || "Korrektur" },
      );
      setItems((current) => current.map((item) => (item.id === enrollment.id ? enrollment : item)));
      setNotice(`Guthaben angepasst: ${enrollment.participantName} → ${enrollment.creditLessons} Lektionen.`);
      setCreditForm({ enrollmentId: "", delta: "", reason: "" });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(enrollment: Enrollment) {
    setError(null);
    setNotice(null);
    try {
      const { enrollment: updated } = await api.patch<{ enrollment: Enrollment }>(`/api/enrollments/${enrollment.id}`, {
        active: !enrollment.active,
      });
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const visible = courseFilter ? items.filter((item) => item.courseId === courseFilter) : items;

  return (
    <>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="card">
        <h2>Neue Anmeldung</h2>
        {!canCreate ? (
          <p className="empty">Bitte zuerst Kurse und Teilnehmende erfassen.</p>
        ) : (
          <form onSubmit={(event) => void submitCreate(event)}>
            <div className="form-grid">
              <label className="field">
                <span>Kurs</span>
                <select onChange={(event) => setCreateForm({ ...createForm, courseId: event.target.value })} value={createForm.courseId}>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} · {course.languageName} {course.level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Teilnehmende:r</span>
                <select onChange={(event) => setCreateForm({ ...createForm, participantId: event.target.value })} value={createForm.participantId}>
                  {participants.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.lastName}, {person.firstName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select onChange={(event) => setCreateForm({ ...createForm, status: event.target.value as EnrollmentStatus })} value={createForm.status}>
                  {ENROLLMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Abrechnung</span>
                <select onChange={(event) => setCreateForm({ ...createForm, billingType: event.target.value as BillingType })} value={createForm.billingType}>
                  {BILLING_TYPES.map((billing) => (
                    <option key={billing} value={billing}>
                      {BILLING_LABELS[billing]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Kostenträger (optional)</span>
                <select onChange={(event) => setCreateForm({ ...createForm, organizationId: event.target.value })} value={createForm.organizationId}>
                  <option value="">–</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Paket-Lektionen (optional)</span>
                <input
                  min={1}
                  onChange={(event) => setCreateForm({ ...createForm, agreedLessons: event.target.value })}
                  type="number"
                  value={createForm.agreedLessons}
                />
              </label>
              <label className="field">
                <span>Preis CHF (optional)</span>
                <input
                  min={0}
                  onChange={(event) => setCreateForm({ ...createForm, agreedPriceChf: event.target.value })}
                  step="0.05"
                  type="number"
                  value={createForm.agreedPriceChf}
                />
              </label>
              <label className="field">
                <span>Start</span>
                <input onChange={(event) => setCreateForm({ ...createForm, startedOn: event.target.value })} type="date" value={createForm.startedOn} />
              </label>
            </div>
            <div className="form-actions">
              <button className="button" disabled={saving} type="submit">
                {saving ? "Speichern …" : "Anmeldung anlegen"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Guthaben anpassen</h2>
        <form onSubmit={(event) => void submitCredit(event)}>
          <div className="form-grid">
            <label className="field">
              <span>Anmeldung</span>
              <select onChange={(event) => setCreditForm({ ...creditForm, enrollmentId: event.target.value })} value={creditForm.enrollmentId}>
                <option value="">–</option>
                {items.map((enrollment) => (
                  <option key={enrollment.id} value={enrollment.id}>
                    {enrollment.participantName} · {enrollment.courseCode}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Delta (± Lektionen)</span>
              <input onChange={(event) => setCreditForm({ ...creditForm, delta: event.target.value })} type="number" value={creditForm.delta} />
            </label>
            <label className="field">
              <span>Grund</span>
              <input onChange={(event) => setCreditForm({ ...creditForm, reason: event.target.value })} value={creditForm.reason} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button button--secondary" disabled={saving} type="submit">
              Anpassen
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>Anmeldungen</h2>
          <select onChange={(event) => setCourseFilter(event.target.value)} value={courseFilter}>
            <option value="">Alle Kurse</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code}
              </option>
            ))}
          </select>
        </div>
        {visible.length === 0 ? (
          <p className="empty">Keine Anmeldungen gefunden.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Teilnehmende:r</th>
                <th>Kurs</th>
                <th>Status</th>
                <th>Abrechnung</th>
                <th>Kostenträger</th>
                <th>Preis</th>
                <th>Guthaben</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {visible.map((enrollment) => (
                <tr key={enrollment.id}>
                  <td>{enrollment.participantName}</td>
                  <td>{enrollment.courseCode}</td>
                  <td>
                    <span className={`badge ${enrollment.status === "active" ? "badge--active" : "badge--inactive"}`}>
                      {STATUS_LABELS[enrollment.status]}
                    </span>
                  </td>
                  <td>{BILLING_LABELS[enrollment.billingType]}</td>
                  <td>{enrollment.organizationName ?? "–"}</td>
                  <td>{enrollment.agreedPriceChf === null ? "–" : `${enrollment.agreedPriceChf.toFixed(2)} CHF`}</td>
                  <td>{enrollment.creditLessons}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button button--secondary button--small" onClick={() => void toggleActive(enrollment)} type="button">
                        {enrollment.active ? "Deaktivieren" : "Aktivieren"}
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
