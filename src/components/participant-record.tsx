"use client";

import { type FormEvent, useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";

type Note = { id: string; body: string; createdAt: string; createdBy: string };
type Enrollment = { id: string; status: string; active: boolean; billingType: string; agreedPriceChf: string | number | null; agreedLessons: number | null; startedOn: string | null; endedOn: string | null; courseCode: string; languageName: string; level: string; teacherName: string; roomName: string | null; locationName: string | null };
type Attendance = { id: string; status: string; note: string | null; startsAt: string; durationMinutes: number; lessonStatus: string; courseCode: string };
type Invoice = { id: string; number: string | null; kind: string; amountChf: string | number; status: string; issuedOn: string | null; dueOn: string | null; paidOn: string | null; courseCode: string };
type ParticipantRecordData = { enrollments: Enrollment[]; attendance: Attendance[]; invoices: Invoice[]; notes: Note[] };

const dateFormatter = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" });
const moneyFormatter = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" });

function date(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "–";
}

function dateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

export function ParticipantRecord({ participantId, participantName, onClose }: { participantId: string; participantName: string; onClose: () => void }) {
  const [record, setRecord] = useState<ParticipantRecordData | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void api.get<{ record: ParticipantRecordData }>(`/api/people/${participantId}?record=participant`).then(
      ({ record: loaded }) => { if (active) setRecord(loaded); },
      (caught) => { if (active) setError(errorMessage(caught)); },
    );
    return () => { active = false; };
  }, [participantId]);

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteBody.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { note } = await api.post<{ note: Note }>(`/api/people/${participantId}`, { body: noteBody.trim() });
      setRecord((current) => current ? { ...current, notes: [note, ...current.notes] } : current);
      setNoteBody("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  const attendanceCounts = record?.attendance.reduce<Record<string, number>>((counts, entry) => ({ ...counts, [entry.status]: (counts[entry.status] ?? 0) + 1 }), {}) ?? {};
  const invoiceTotal = record?.invoices.filter((invoice) => invoice.status !== "cancelled").reduce((total, invoice) => total + Number(invoice.amountChf), 0) ?? 0;

  return (
    <section className="card participant-record">
      <div className="page-header">
        <div><h2>Akte: {participantName}</h2><p>Kurse, Anwesenheit, Kosten und Notizen.</p></div>
        <button className="button button--secondary button--small" onClick={onClose} type="button">Akte schliessen</button>
      </div>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {!record ? <p className="empty">Akte wird geladen …</p> : (
        <>
          <div className="grid-cards participant-record__summary">
            <div className="stat"><div className="stat__value">{record.enrollments.filter((entry) => entry.active).length}</div><div className="stat__label">Aktive Kurse</div></div>
            <div className="stat"><div className="stat__value">{attendanceCounts.present ?? 0}</div><div className="stat__label">Anwesend</div></div>
            <div className="stat"><div className="stat__value">{attendanceCounts.excused ?? 0}</div><div className="stat__label">Entschuldigt</div></div>
            <div className="stat"><div className="stat__value">{moneyFormatter.format(invoiceTotal)}</div><div className="stat__label">Rechnungen</div></div>
          </div>

          <h3>Notizen</h3>
          <form className="participant-record__note-form" onSubmit={(event) => void addNote(event)}>
            <textarea aria-label="Neue Notiz" onChange={(event) => setNoteBody(event.target.value)} placeholder="Neue Notiz erfassen …" value={noteBody} />
            <button className="button button--small" disabled={saving} type="submit">{saving ? "Speichern …" : "Notiz speichern"}</button>
          </form>
          {record.notes.length === 0 ? <p className="empty">Noch keine Notizen.</p> : <ul className="participant-record__notes">{record.notes.map((note) => <li key={note.id}><p>{note.body}</p><small>{dateTime(note.createdAt)} · {note.createdBy}</small></li>)}</ul>}

          <h3>Kurse</h3>
          {record.enrollments.length === 0 ? <p className="empty">Keine Kursanmeldungen.</p> : <table className="data"><thead><tr><th>Kurs</th><th>Lehrperson / Raum</th><th>Status</th><th>Vereinbarung</th></tr></thead><tbody>{record.enrollments.map((entry) => <tr key={entry.id}><td>{entry.courseCode} · {entry.languageName} {entry.level}</td><td>{entry.teacherName} · {entry.locationName ?? "–"} / {entry.roomName ?? "–"}</td><td>{entry.status}</td><td>{entry.agreedPriceChf === null ? "–" : moneyFormatter.format(Number(entry.agreedPriceChf))}{entry.agreedLessons ? ` / ${entry.agreedLessons} Lektionen` : ""}</td></tr>)}</tbody></table>}

          <h3>Anwesenheit</h3>
          {record.attendance.length === 0 ? <p className="empty">Noch keine Anwesenheiten erfasst.</p> : <table className="data"><thead><tr><th>Datum</th><th>Kurs</th><th>Status</th><th>Notiz</th></tr></thead><tbody>{record.attendance.map((entry) => <tr key={entry.id}><td>{dateTime(entry.startsAt)}</td><td>{entry.courseCode}</td><td>{entry.status}</td><td>{entry.note ?? "–"}</td></tr>)}</tbody></table>}

          <h3>Kosten / Rechnungen</h3>
          {record.invoices.length === 0 ? <p className="empty">Noch keine Rechnungen erstellt.</p> : <table className="data"><thead><tr><th>Rechnung</th><th>Kurs</th><th>Datum</th><th>Status</th><th>Betrag</th></tr></thead><tbody>{record.invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.number ?? invoice.kind}</td><td>{invoice.courseCode}</td><td>{date(invoice.issuedOn)}</td><td>{invoice.status}</td><td>{moneyFormatter.format(Number(invoice.amountChf))}</td></tr>)}</tbody></table>}
        </>
      )}
    </section>
  );
}
