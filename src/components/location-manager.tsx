"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { Location } from "@/lib/types";

type FormState = { name: string; address: string; sortOrder: string };

const emptyForm: FormState = { name: "", address: "", sortOrder: "" };

function sortLocations(list: Location[]): Location[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
}

export function LocationManager({ initialLocations }: { initialLocations: Location[] }) {
  const [items, setItems] = useState(() => sortLocations(initialLocations));
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

  function startEdit(location: Location) {
    setEditingId(location.id);
    setForm({ name: location.name, address: location.address, sortOrder: String(location.sortOrder) });
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = { name: form.name.trim(), address: form.address.trim(), sortOrder: Number(form.sortOrder) };
    try {
      if (editingId) {
        const { location } = await api.patch<{ location: Location }>(`/api/locations/${editingId}`, payload);
        setItems((current) => sortLocations(current.map((item) => (item.id === location.id ? location : item))));
        setNotice("Standort aktualisiert.");
      } else {
        const { location } = await api.post<{ location: Location }>("/api/locations", payload);
        setItems((current) => sortLocations([...current, location]));
        setNotice("Standort angelegt.");
      }
      reset();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(location: Location) {
    setError(null);
    setNotice(null);
    try {
      const { location: updated } = await api.patch<{ location: Location }>(`/api/locations/${location.id}`, {
        active: !location.active,
      });
      setItems((current) => sortLocations(current.map((item) => (item.id === updated.id ? updated : item))));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function remove(location: Location) {
    if (!window.confirm(`Standort «${location.name}» wirklich löschen?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/api/locations/${location.id}`);
      setItems((current) => current.filter((item) => item.id !== location.id));
      setNotice("Standort gelöscht.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      <div className="card">
        <h2>{editingId ? "Standort bearbeiten" : "Neuer Standort"}</h2>
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input
                maxLength={100}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label className="field">
              <span>Reihenfolge</span>
              <input
                max={999}
                min={1}
                onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
                required
                type="number"
                value={form.sortOrder}
              />
            </label>
            <label className="field field--full">
              <span>Adresse</span>
              <input
                maxLength={300}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                required
                value={form.address}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="button" disabled={saving} type="submit">
              {saving ? "Speichern …" : editingId ? "Änderungen speichern" : "Standort anlegen"}
            </button>
            {editingId ? (
              <button className="button button--secondary" onClick={reset} type="button">
                Abbrechen
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="card">
        <h2>Standorte</h2>
        {items.length === 0 ? (
          <p className="empty">Noch keine Standorte erfasst.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Adresse</th>
                <th>Reihenfolge</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((location) => (
                <tr key={location.id}>
                  <td>{location.name}</td>
                  <td>{location.address}</td>
                  <td>{location.sortOrder}</td>
                  <td>
                    <span className={`badge ${location.active ? "badge--active" : "badge--inactive"}`}>
                      {location.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button button--secondary button--small" onClick={() => startEdit(location)} type="button">
                        Bearbeiten
                      </button>
                      <button className="button button--secondary button--small" onClick={() => void toggleActive(location)} type="button">
                        {location.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      <button className="button button--secondary button--small" onClick={() => void remove(location)} type="button">
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
