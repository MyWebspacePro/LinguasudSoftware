"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { RENTAL_KINDS } from "@/lib/types";
import type { RentalKind, Room, RoomRental } from "@/lib/types";

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const KIND_LABELS: Record<RentalKind, string> = { one_time: "Einmalig", series: "Wiederkehrend" };

export function RoomRentalManager({ initialRentals, rooms }: { initialRentals: RoomRental[]; rooms: Room[] }) {
  const [items, setItems] = useState(initialRentals);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    roomId: rooms[0]?.id ?? "",
    title: "",
    kind: "one_time" as RentalKind,
    startsOn: new Date().toISOString().slice(0, 10),
    endsOn: "",
    weekday: "5",
    startTime: "18:00",
    endTime: "20:00",
    customerName: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
  }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { rental } = await api.post<{ rental: RoomRental }>("/api/room-rentals", {
        roomId: form.roomId,
        title: form.title.trim(),
        kind: form.kind,
        startsOn: form.startsOn,
        endsOn: form.endsOn || null,
        weekday: form.kind === "series" ? Number(form.weekday) : null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        customerName: form.customerName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        notes: form.notes.trim() || null,
      });
      setItems((current) => [rental, ...current]);
      setNotice("Vermietung angelegt.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function remove(rental: RoomRental) {
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/api/room-rentals/${rental.id}`);
      setItems((current) => current.filter((item) => item.id !== rental.id));
      setNotice("Vermietung entfernt.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="card">
        <h2>Neue Vermietung</h2>
        {rooms.length === 0 ? (
          <p className="empty">Bitte zuerst Räume erfassen.</p>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <label className="field">
                <span>Raum</span>
                <select onChange={(event) => setForm({ ...form, roomId: event.target.value })} value={form.roomId}>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.locationName} · {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Titel</span>
                <input maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} />
              </label>
              <label className="field">
                <span>Art</span>
                <select onChange={(event) => setForm({ ...form, kind: event.target.value as RentalKind })} value={form.kind}>
                  {RENTAL_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ab Datum</span>
                <input onChange={(event) => setForm({ ...form, startsOn: event.target.value })} required type="date" value={form.startsOn} />
              </label>
              <label className="field">
                <span>Bis Datum (optional)</span>
                <input onChange={(event) => setForm({ ...form, endsOn: event.target.value })} type="date" value={form.endsOn} />
              </label>
              {form.kind === "series" ? (
                <label className="field">
                  <span>Wochentag</span>
                  <select onChange={(event) => setForm({ ...form, weekday: event.target.value })} value={form.weekday}>
                    {WEEKDAYS.map((label, weekday) => (
                      <option key={label} value={String(weekday)}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="field">
                <span>Von</span>
                <input onChange={(event) => setForm({ ...form, startTime: event.target.value })} type="time" value={form.startTime} />
              </label>
              <label className="field">
                <span>Bis</span>
                <input onChange={(event) => setForm({ ...form, endTime: event.target.value })} type="time" value={form.endTime} />
              </label>
              <label className="field">
                <span>Kunde</span>
                <input maxLength={200} onChange={(event) => setForm({ ...form, customerName: event.target.value })} value={form.customerName} />
              </label>
              <label className="field">
                <span>Kontakt E-Mail</span>
                <input onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} type="email" value={form.contactEmail} />
              </label>
              <label className="field">
                <span>Kontakt Telefon</span>
                <input onChange={(event) => setForm({ ...form, contactPhone: event.target.value })} value={form.contactPhone} />
              </label>
              <label className="field field--full">
                <span>Notizen</span>
                <textarea onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} value={form.notes} />
              </label>
            </div>
            <div className="form-actions">
              <button className="button" disabled={saving} type="submit">
                {saving ? "Speichern …" : "Vermietung anlegen"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Vermietungen</h2>
        {items.length === 0 ? (
          <p className="empty">Noch keine Vermietungen erfasst.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Raum</th>
                <th>Art</th>
                <th>Zeitraum</th>
                <th>Zeit</th>
                <th>Kunde</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((rental) => (
                <tr key={rental.id}>
                  <td>{rental.title}</td>
                  <td>
                    {rental.locationName} · {rental.roomName}
                  </td>
                  <td>{KIND_LABELS[rental.kind]}</td>
                  <td>
                    {rental.startsOn}
                    {rental.endsOn ? ` – ${rental.endsOn}` : ""}
                    {rental.kind === "series" && rental.weekday !== null ? ` (${WEEKDAYS[rental.weekday]})` : ""}
                  </td>
                  <td>
                    {rental.startTime ?? "–"}
                    {rental.endTime ? ` – ${rental.endTime}` : ""}
                  </td>
                  <td>{rental.customerName ?? "–"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="button button--danger button--small" onClick={() => void remove(rental)} type="button">
                        Entfernen
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
