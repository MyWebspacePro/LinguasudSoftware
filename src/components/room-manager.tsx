"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { Location, Room } from "@/lib/types";

type FormState = { locationId: string; name: string; floor: string; capacity: string };

function sortRooms(list: Room[]): Room[] {
  return [...list].sort((a, b) => a.locationName.localeCompare(b.locationName, "de") || a.name.localeCompare(b.name, "de"));
}

export function RoomManager({ initialRooms, locations }: { initialRooms: Room[]; locations: Location[] }) {
  const defaultLocationId = locations[0]?.id ?? "";
  const emptyForm: FormState = { locationId: defaultLocationId, name: "", floor: "", capacity: "" };

  const [items, setItems] = useState(() => sortRooms(initialRooms));
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
  }

  function startEdit(room: Room) {
    setEditingId(room.id);
    setForm({ locationId: room.locationId, name: room.name, floor: room.floor ?? "", capacity: String(room.capacity) });
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = {
      locationId: form.locationId,
      name: form.name.trim(),
      floor: form.floor.trim() || null,
      capacity: Number(form.capacity),
    };
    try {
      if (editingId) {
        const { room } = await api.patch<{ room: Room }>(`/api/rooms/${editingId}`, payload);
        setItems((current) => sortRooms(current.map((item) => (item.id === room.id ? room : item))));
        setNotice("Raum aktualisiert.");
      } else {
        const { room } = await api.post<{ room: Room }>("/api/rooms", payload);
        setItems((current) => sortRooms([...current, room]));
        setNotice("Raum angelegt.");
      }
      reset();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(room: Room) {
    setError(null);
    setNotice(null);
    try {
      const { room: updated } = await api.patch<{ room: Room }>(`/api/rooms/${room.id}`, { active: !room.active });
      setItems((current) => sortRooms(current.map((item) => (item.id === updated.id ? updated : item))));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function remove(room: Room) {
    if (!window.confirm(`Raum «${room.name}» wirklich löschen?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/api/rooms/${room.id}`);
      setItems((current) => current.filter((item) => item.id !== room.id));
      setNotice("Raum gelöscht.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const canCreate = locations.length > 0;

  return (
    <>
      <div className="card">
        <h2>{editingId ? "Raum bearbeiten" : "Neuer Raum"}</h2>
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        {!canCreate ? (
          <p className="empty">Bitte zuerst einen Standort erfassen.</p>
        ) : (
          <form onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <label className="field">
                <span>Standort</span>
                <select onChange={(event) => setForm({ ...form, locationId: event.target.value })} required value={form.locationId}>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Raumname</span>
                <input maxLength={80} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
              </label>
              <label className="field">
                <span>Etage</span>
                <input maxLength={60} onChange={(event) => setForm({ ...form, floor: event.target.value })} value={form.floor} />
              </label>
              <label className="field">
                <span>Kapazität</span>
                <input
                  max={200}
                  min={1}
                  onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                  required
                  type="number"
                  value={form.capacity}
                />
              </label>
            </div>
            <div className="form-actions">
              <button className="button" disabled={saving} type="submit">
                {saving ? "Speichern …" : editingId ? "Änderungen speichern" : "Raum anlegen"}
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
        <h2>Räume</h2>
        {items.length === 0 ? (
          <p className="empty">Noch keine Räume erfasst.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Raum</th>
                <th>Standort</th>
                <th>Etage</th>
                <th>Kapazität</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((room) => (
                <tr key={room.id}>
                  <td>{room.name}</td>
                  <td>{room.locationName}</td>
                  <td>{room.floor ?? "–"}</td>
                  <td>{room.capacity}</td>
                  <td>
                    <span className={`badge ${room.active ? "badge--active" : "badge--inactive"}`}>
                      {room.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button button--secondary button--small" onClick={() => startEdit(room)} type="button">
                        Bearbeiten
                      </button>
                      <button className="button button--secondary button--small" onClick={() => void toggleActive(room)} type="button">
                        {room.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      <button className="button button--secondary button--small" onClick={() => void remove(room)} type="button">
                        Löschen
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
