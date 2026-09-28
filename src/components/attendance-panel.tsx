"use client";

import { useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { ATTENDANCE_STATUSES } from "@/lib/types";
import type { AttendanceStatus, LessonAttendanceRow } from "@/lib/types";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Anwesend",
  excused: "Entschuldigt",
  unexcused: "Unentschuldigt",
};

export function AttendancePanel({
  lessonId,
  canExcuse,
  onCompleted,
}: {
  lessonId: string;
  canExcuse: boolean;
  onCompleted: () => void;
}) {
  const [rows, setRows] = useState<LessonAttendanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setError(null);
      try {
        const data = await api.get<{ attendance: LessonAttendanceRow[] }>(`/api/lessons/${lessonId}/attendance`);
        if (active) setRows(data.attendance);
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      }
    })();
    return () => {
      active = false;
    };
  }, [lessonId]);

  function setStatus(enrollmentId: string, status: AttendanceStatus) {
    setRows((current) => current.map((row) => (row.enrollmentId === enrollmentId ? { ...row, status } : row)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const entries = rows.filter((row) => row.status !== null).map((row) => ({ enrollmentId: row.enrollmentId, status: row.status }));
      const data = await api.put<{ attendance: LessonAttendanceRow[] }>(`/api/lessons/${lessonId}/attendance`, { entries });
      setRows(data.attendance);
      setNotice("Anwesenheiten gespeichert.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.post<{ completed: boolean; consumed: number }>(`/api/lessons/${lessonId}/complete`, {});
      setNotice(`Lektion abgeschlossen. ${result.consumed} Lektionen verrechnet.`);
      onCompleted();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>Anwesenheit</h3>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}
      {rows.length === 0 ? (
        <p className="empty">Keine aktiven Anmeldungen.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Teilnehmende:r</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.enrollmentId}>
                <td>{row.participantName}</td>
                <td>
                  <select
                    onChange={(event) => setStatus(row.enrollmentId, event.target.value as AttendanceStatus)}
                    value={row.status ?? ""}
                  >
                    <option value="" disabled>
                      Bitte wählen
                    </option>
                    {ATTENDANCE_STATUSES.map((status) => (
                      <option disabled={!canExcuse && status === "excused"} key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="form-actions">
        <button className="button button--secondary" disabled={saving} onClick={() => void save()} type="button">
          Speichern
        </button>
        <button className="button" disabled={saving} onClick={() => void complete()} type="button">
          Als absolviert markieren
        </button>
      </div>
    </div>
  );
}
