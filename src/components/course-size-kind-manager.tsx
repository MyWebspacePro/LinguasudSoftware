"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { CourseSizeKind } from "@/lib/types";

type FormState = {
  code: string;
  name: string;
  minParticipants: string;
  maxParticipants: string;
  standardDurationMinutes: string;
  isOnline: boolean;
  sortOrder: string;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  minParticipants: "1",
  maxParticipants: "1",
  standardDurationMinutes: "",
  isOnline: false,
  sortOrder: "0",
};

function sortKinds(list: CourseSizeKind[]): CourseSizeKind[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
}

export function CourseSizeKindManager({ initialKinds }: { initialKinds: CourseSizeKind[] }) {
  const [items, setItems] = useState(() => sortKinds(initialKinds));
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

  function startEdit(kind: CourseSizeKind) {
    setEditingId(kind.id);
    setForm({
      code: kind.code,
      name: kind.name,
      minParticipants: String(kind.minParticipants),
      maxParticipants: String(kind.maxParticipants),
      standardDurationMinutes: kind.standardDurationMinutes === null ? "" : String(kind.standardDurationMinutes),
      isOnline: kind.isOnline,
      sortOrder: String(kind.sortOrder),
    });
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      minParticipants: Number(form.minParticipants),
      maxParticipants: Number(form.maxParticipants),
      standardDurationMinutes: form.standardDurationMinutes ? Number(form.standardDurationMinutes) : null,
      isOnline: form.isOnline,
      sortOrder: Number(form.sortOrder),
    };
    try {
      if (editingId) {
        const { courseSizeKind } = await api.patch<{ courseSizeKind: CourseSizeKind }>(`/api/course-size-kinds/${editingId}`, payload);
        setItems((current) => sortKinds(current.map((item) => (item.id === courseSizeKind.id ? courseSizeKind : item))));
        setNotice("Kursart aktualisiert.");
      } else {
        const { courseSizeKind } = await api.post<{ courseSizeKind: CourseSizeKind }>("/api/course-size-kinds", payload);
        setItems((current) => sortKinds([...current, courseSizeKind]));
        setNotice("Kursart angelegt.");
      }
      reset();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(kind: CourseSizeKind) {
    setError(null);
    setNotice(null);
    try {
      const { courseSizeKind } = await api.patch<{ courseSizeKind: CourseSizeKind }>(`/api/course-size-kinds/${kind.id}`, {
        active: !kind.active,
      });
      setItems((current) => sortKinds(current.map((item) => (item.id === courseSizeKind.id ? courseSizeKind : item))));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <div className="card">
      <h2>Kursarten / Gruppengrössen</h2>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}
      <form onSubmit={(event) => void submit(event)}>
        <div className="form-grid">
          <label className="field">
            <span>Kürzel</span>
            <input maxLength={6} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required value={form.code} />
          </label>
          <label className="field">
            <span>Name</span>
            <input maxLength={80} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
          </label>
          <label className="field">
            <span>Min. Teilnehmende</span>
            <input min={1} onChange={(event) => setForm({ ...form, minParticipants: event.target.value })} required type="number" value={form.minParticipants} />
          </label>
          <label className="field">
            <span>Max. Teilnehmende</span>
            <input min={1} onChange={(event) => setForm({ ...form, maxParticipants: event.target.value })} required type="number" value={form.maxParticipants} />
          </label>
          <label className="field">
            <span>Standarddauer (Min., optional)</span>
            <input
              step={15}
              min={15}
              onChange={(event) => setForm({ ...form, standardDurationMinutes: event.target.value })}
              type="number"
              value={form.standardDurationMinutes}
            />
          </label>
          <label className="field">
            <span>Reihenfolge</span>
            <input min={0} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} type="number" value={form.sortOrder} />
          </label>
          <label className="checkbox" style={{ alignSelf: "end" }}>
            <input checked={form.isOnline} onChange={(event) => setForm({ ...form, isOnline: event.target.checked })} type="checkbox" />
            Online-Kursart
          </label>
        </div>
        <div className="form-actions">
          <button className="button" disabled={saving} type="submit">
            {saving ? "Speichern …" : editingId ? "Änderungen speichern" : "Kursart anlegen"}
          </button>
          {editingId ? (
            <button className="button button--secondary" onClick={reset} type="button">
              Abbrechen
            </button>
          ) : null}
        </div>
      </form>

      <table className="data" style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Kürzel</th>
            <th>Name</th>
            <th>Grösse</th>
            <th>Dauer</th>
            <th>Online</th>
            <th>Status</th>
            <th aria-label="Aktionen" />
          </tr>
        </thead>
        <tbody>
          {items.map((kind) => (
            <tr key={kind.id}>
              <td>{kind.code}</td>
              <td>{kind.name}</td>
              <td>
                {kind.minParticipants}–{kind.maxParticipants}
              </td>
              <td>{kind.standardDurationMinutes === null ? "–" : `${kind.standardDurationMinutes} Min.`}</td>
              <td>{kind.isOnline ? "Ja" : "Nein"}</td>
              <td>
                <span className={`badge ${kind.active ? "badge--active" : "badge--inactive"}`}>{kind.active ? "Aktiv" : "Inaktiv"}</span>
              </td>
              <td>
                <div className="row-actions">
                  <button className="button button--secondary button--small" onClick={() => startEdit(kind)} type="button">
                    Bearbeiten
                  </button>
                  <button className="button button--secondary button--small" onClick={() => void toggleActive(kind)} type="button">
                    {kind.active ? "Deaktivieren" : "Aktivieren"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
