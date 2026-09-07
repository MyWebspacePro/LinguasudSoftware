"use client";

import { useCallback, useEffect, useState } from "react";

type OfficeAccount = { id: string; name: string; email: string; role: "office"; active: boolean; created_at: string };

function apiError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

export function OfficeAccountsWorkspace({ currentUserId, onClose }: { currentUserId?: string; onClose: () => void }) {
  const [accounts, setAccounts] = useState<OfficeAccount[]>([]);
  const [editing, setEditing] = useState<OfficeAccount | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/users?role=office", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json() as { users?: OfficeAccount[]; error?: string };
      if (!response.ok) throw new Error(apiError(payload, "Bürokonten konnten nicht geladen werden."));
      setAccounts(payload.users ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Bürokonten konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  async function createAccount(formData: FormData) {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/users", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password"), role: "office" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Bürokonto konnte nicht angelegt werden."));
      setIsCreating(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Bürokonto konnte nicht angelegt werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateAccount(formData: FormData) {
    if (!editing) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${editing.id}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password") || undefined, active: formData.get("active") === "on" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiError(payload, "Bürokonto konnte nicht geändert werden."));
      setEditing(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Bürokonto konnte nicht geändert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return <div className="dialog-backdrop" role="presentation"><section className="attendance-dialog attendance-dialog--wide" aria-labelledby="office-accounts-title" role="dialog" aria-modal="true">
    <button aria-label="Bürokonten schliessen" className="dialog-close" onClick={onClose} type="button">×</button>
    <p className="eyebrow">Büroverwaltung</p>
    <h2 id="office-accounts-title">Bürokonten</h2>
    <p className="dialog-course">Das Büro hat Vollzugriff. Lehrpersonen und Teilnehmende werden in ihren jeweiligen Verwaltungen mit eigenem Zugang angelegt.</p>
    {error ? <p className="planner-state" role="alert">{error}</p> : null}
    <div className="course-participant-list">{accounts.map((account) => <div className={`course-participant-row${account.active ? "" : " is-ended"}`} key={account.id}>
      <div><strong>{account.name}</strong><span>{account.email}</span>{!account.active ? <small>Zugang deaktiviert</small> : null}</div>
      <button className="quiet-button" onClick={() => { setIsCreating(false); setEditing(account); }} type="button">Bearbeiten</button>
    </div>)}</div>
    {!isCreating && !editing ? <div className="dialog-actions"><button className="quiet-button" onClick={onClose} type="button">Schliessen</button><button className="primary-button" onClick={() => setIsCreating(true)} type="button">+ Bürokonto anlegen</button></div> : null}
    {isCreating ? <form action={createAccount}><div className="form-grid"><label>Name<input name="name" required /></label><label>E-Mail<input name="email" required type="email" /></label><label className="form-grid__full">Startpasswort<input minLength={12} name="password" required type="password" /></label></div><div className="dialog-actions"><button className="quiet-button" disabled={isSaving} onClick={() => setIsCreating(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? "Wird angelegt …" : "Bürokonto anlegen"}</button></div></form> : null}
    {editing ? <form action={updateAccount}><div className="form-grid"><label>Name<input defaultValue={editing.name} name="name" required /></label><label>E-Mail<input defaultValue={editing.email} name="email" required type="email" /></label><label>Neues Passwort (optional)<input minLength={12} name="password" placeholder="Mindestens 12 Zeichen" type="password" /></label><label className="checkbox-field"><input defaultChecked={editing.active} disabled={editing.id === currentUserId} name="active" type="checkbox" />Für Anmeldung aktiv</label></div>{editing.id === currentUserId ? <p className="form-hint">Das eigene Bürokonto kann nicht deaktiviert werden.</p> : null}<div className="dialog-actions"><button className="quiet-button" disabled={isSaving} onClick={() => setEditing(null)} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? "Wird gespeichert …" : "Konto speichern"}</button></div></form> : null}
  </section></div>;
}
