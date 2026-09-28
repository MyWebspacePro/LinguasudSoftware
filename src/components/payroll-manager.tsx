"use client";

import { type FormEvent, useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { CourseSizeKind, PayrollEntry, Person, TeacherRate } from "@/lib/types";

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export function PayrollManager({
  teachers,
  sizeKinds,
}: {
  teachers: Person[];
  sizeKinds: CourseSizeKind[];
}) {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [rates, setRates] = useState<TeacherRate[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rateForm, setRateForm] = useState({ courseSizeKindId: sizeKinds[0]?.id ?? "", rateChf: "" });

  useEffect(() => {
    if (!teacherId) return;
    let active = true;
    void (async () => {
      try {
        const data = await api.get<{ rates: TeacherRate[] }>(`/api/teachers/${teacherId}/rates`);
        if (active) setRates(data.rates);
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      }
    })();
    return () => {
      active = false;
    };
  }, [teacherId]);

  async function saveRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { rates: updated } = await api.post<{ rates: TeacherRate[] }>(`/api/teachers/${teacherId}/rates`, {
        courseSizeKindId: rateForm.courseSizeKindId,
        rateChf: Number(rateForm.rateChf),
      });
      setRates(updated);
      setRateForm({ ...rateForm, rateChf: "" });
      setNotice("Honorarsatz gespeichert.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function removeRate(rate: TeacherRate) {
    setError(null);
    try {
      await api.delete(`/api/teachers/${teacherId}/rates/${rate.id}`);
      setRates((current) => current.filter((item) => item.id !== rate.id));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function calculate() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api.post<{ payroll: PayrollEntry[] }>("/api/payroll", { period });
      setPayroll(data.payroll);
      setNotice(`Honorare für ${period} berechnet.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function loadPayroll() {
    setError(null);
    try {
      const data = await api.get<{ payroll: PayrollEntry[] }>(`/api/payroll?period=${period}`);
      setPayroll(data.payroll);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function markPaid(entry: PayrollEntry) {
    if (!entry.id) {
      setError("Bitte zuerst die Honorare berechnen.");
      return;
    }
    try {
      const data = await api.patch<{ payroll: PayrollEntry[] }>(`/api/payroll/${entry.id}`, {});
      setPayroll(data.payroll);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="card">
        <h2>Honorarsätze</h2>
        {teachers.length === 0 ? (
          <p className="empty">Keine Lehrpersonen erfasst.</p>
        ) : (
          <>
            <div className="toolbar">
              <label className="field" style={{ minWidth: "220px" }}>
                <span>Lehrperson</span>
                <select onChange={(event) => setTeacherId(event.target.value)} value={teacherId}>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <form onSubmit={(event) => void saveRate(event)}>
              <div className="form-grid">
                <label className="field">
                  <span>Kursart</span>
                  <select onChange={(event) => setRateForm({ ...rateForm, courseSizeKindId: event.target.value })} value={rateForm.courseSizeKindId}>
                    {sizeKinds.map((kind) => (
                      <option key={kind.id} value={kind.id}>
                        {kind.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Satz CHF pro Lektion</span>
                  <input min={0} onChange={(event) => setRateForm({ ...rateForm, rateChf: event.target.value })} required step="0.05" type="number" value={rateForm.rateChf} />
                </label>
              </div>
              <div className="form-actions">
                <button className="button" disabled={saving} type="submit">
                  Satz speichern
                </button>
              </div>
            </form>
            <table className="data" style={{ marginTop: "1rem" }}>
              <thead>
                <tr>
                  <th>Kursart</th>
                  <th>Satz CHF</th>
                  <th aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id}>
                    <td>{rate.courseSizeKindName}</td>
                    <td>{rate.rateChf.toFixed(2)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="button button--danger button--small" onClick={() => void removeRate(rate)} type="button">
                          Entfernen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>Honorarabrechnung</h2>
          <input onChange={(event) => setPeriod(event.target.value)} type="month" value={period} />
          <button className="button button--secondary button--small" disabled={saving} onClick={() => void loadPayroll()} type="button">
            Anzeigen
          </button>
          <button className="button button--small" disabled={saving} onClick={() => void calculate()} type="button">
            Berechnen
          </button>
        </div>
        {payroll.length === 0 ? (
          <p className="empty">Keine geleisteten Lektionen in diesem Monat.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Lehrperson</th>
                <th>Lektionen</th>
                <th>Betrag CHF</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {payroll.map((entry) => (
                <tr key={entry.teacherId}>
                  <td>{entry.teacherName}</td>
                  <td>{entry.lessonsCount}</td>
                  <td>{entry.amountChf.toFixed(2)}</td>
                  <td>
                    <span className={`badge ${entry.paidAt ? "badge--active" : "badge--inactive"}`}>
                      {entry.paidAt ? "Bezahlt" : "Offen"}
                    </span>
                  </td>
                  <td>
                    {!entry.paidAt ? (
                      <div className="row-actions">
                        <button className="button button--secondary button--small" onClick={() => void markPaid(entry)} type="button">
                          Als bezahlt markieren
                        </button>
                      </div>
                    ) : null}
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
