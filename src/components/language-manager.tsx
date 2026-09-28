"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { Language } from "@/lib/types";

type FormState = { code: string; name: string; sortOrder: string };
const emptyForm: FormState = { code: "", name: "", sortOrder: "0" };

function sortLanguages(list: Language[]): Language[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
}

export function LanguageManager({ initialLanguages }: { initialLanguages: Language[] }) {
  const [items, setItems] = useState(() => sortLanguages(initialLanguages));
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

  function startEdit(language: Language) {
    setEditingId(language.id);
    setForm({ code: language.code, name: language.name, sortOrder: String(language.sortOrder) });
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = { code: form.code.trim(), name: form.name.trim(), sortOrder: Number(form.sortOrder) };
    try {
      if (editingId) {
        const { language } = await api.patch<{ language: Language }>(`/api/languages/${editingId}`, payload);
        setItems((current) => sortLanguages(current.map((item) => (item.id === language.id ? language : item))));
        setNotice("Sprache aktualisiert.");
      } else {
        const { language } = await api.post<{ language: Language }>("/api/languages", payload);
        setItems((current) => sortLanguages([...current, language]));
        setNotice("Sprache angelegt.");
      }
      reset();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(language: Language) {
    setError(null);
    setNotice(null);
    try {
      const { language: updated } = await api.patch<{ language: Language }>(`/api/languages/${language.id}`, {
        active: !language.active,
      });
      setItems((current) => sortLanguages(current.map((item) => (item.id === updated.id ? updated : item))));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <div className="card">
      <h2>Sprachen</h2>
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
            <span>Reihenfolge</span>
            <input min={0} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} type="number" value={form.sortOrder} />
          </label>
        </div>
        <div className="form-actions">
          <button className="button" disabled={saving} type="submit">
            {saving ? "Speichern …" : editingId ? "Änderungen speichern" : "Sprache anlegen"}
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
            <th>Reihenfolge</th>
            <th>Status</th>
            <th aria-label="Aktionen" />
          </tr>
        </thead>
        <tbody>
          {items.map((language) => (
            <tr key={language.id}>
              <td>{language.code}</td>
              <td>{language.name}</td>
              <td>{language.sortOrder}</td>
              <td>
                <span className={`badge ${language.active ? "badge--active" : "badge--inactive"}`}>
                  {language.active ? "Aktiv" : "Inaktiv"}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <button className="button button--secondary button--small" onClick={() => startEdit(language)} type="button">
                    Bearbeiten
                  </button>
                  <button className="button button--secondary button--small" onClick={() => void toggleActive(language)} type="button">
                    {language.active ? "Deaktivieren" : "Aktivieren"}
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
