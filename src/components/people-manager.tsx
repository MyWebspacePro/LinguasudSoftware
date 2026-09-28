"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { ROLES, type Role } from "@/lib/roles";
import { SALUTATIONS, type Person, type Salutation } from "@/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  office: "Büro",
  teacher: "Lehrperson",
  participant: "Teilnehmende:r",
  finance: "Finanzen",
  admin: "Admin",
};

const SALUTATION_LABELS: Record<Salutation, string> = {
  herr: "Herr",
  frau: "Frau",
  divers: "Divers",
};

type FormState = {
  salutation: "" | Salutation;
  firstName: string;
  lastName: string;
  email: string;
  phone1: string;
  phone2: string;
  whatsappOk: boolean;
  signalOk: boolean;
  street: string;
  postalCode: string;
  city: string;
  addressExtra: string;
  roles: Role[];
  password: string;
};

const emptyForm: FormState = {
  salutation: "",
  firstName: "",
  lastName: "",
  email: "",
  phone1: "",
  phone2: "",
  whatsappOk: false,
  signalOk: false,
  street: "",
  postalCode: "",
  city: "",
  addressExtra: "",
  roles: ["participant"],
  password: "",
};

function sortPeople(list: Person[]): Person[] {
  return [...list].sort((a, b) => a.lastName.localeCompare(b.lastName, "de") || a.firstName.localeCompare(b.firstName, "de"));
}

const SECTION_LABELS: Record<Role, string> = {
  office: "Büromitarbeitende",
  teacher: "Lehrpersonen",
  participant: "Teilnehmende",
  finance: "Finanzmitarbeitende",
  admin: "Administration",
};

export function PeopleManager({ initialPeople, defaultRole = "participant" }: { initialPeople: Person[]; defaultRole?: Role }) {
  const [items, setItems] = useState(() => sortPeople(initialPeople));
  const [form, setForm] = useState<FormState>(() => ({ ...emptyForm, roles: [defaultRole] }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setForm({ ...emptyForm, roles: [defaultRole] });
    setEditingId(null);
    setError(null);
  }

  function startEdit(person: Person) {
    setEditingId(person.id);
    setForm({
      salutation: person.salutation ?? "",
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      phone1: person.phone1 ?? "",
      phone2: person.phone2 ?? "",
      whatsappOk: person.whatsappOk,
      signalOk: person.signalOk,
      street: person.street ?? "",
      postalCode: person.postalCode ?? "",
      city: person.city ?? "",
      addressExtra: person.addressExtra ?? "",
      roles: person.roles,
      password: "",
    });
    setError(null);
    setNotice(null);
  }

  function toggleRole(role: Role) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(role) ? current.roles.filter((value) => value !== role) : [...current.roles, role],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (form.roles.length === 0) {
      setError("Bitte mindestens eine Rolle auswählen.");
      return;
    }
    if (!editingId && form.password.length < 12) {
      setError("Das Startpasswort muss mindestens 12 Zeichen haben.");
      return;
    }

    setSaving(true);
    const base = {
      salutation: form.salutation || null,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone1: form.phone1.trim() || null,
      phone2: form.phone2.trim() || null,
      whatsappOk: form.whatsappOk,
      signalOk: form.signalOk,
      street: form.street.trim() || null,
      postalCode: form.postalCode.trim() || null,
      city: form.city.trim() || null,
      addressExtra: form.addressExtra.trim() || null,
      roles: form.roles,
    };

    try {
      if (editingId) {
        const payload = form.password ? { ...base, password: form.password } : base;
        const { person } = await api.patch<{ person: Person }>(`/api/people/${editingId}`, payload);
        setItems((current) => sortPeople(current.map((item) => (item.id === person.id ? person : item))));
        setNotice("Person aktualisiert.");
      } else {
        const { person } = await api.post<{ person: Person }>("/api/people", { ...base, password: form.password });
        setItems((current) => sortPeople([...current, person]));
        setNotice("Person angelegt.");
      }
      reset();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(person: Person) {
    setError(null);
    setNotice(null);
    try {
      const { person: updated } = await api.patch<{ person: Person }>(`/api/people/${person.id}`, { active: !person.active });
      setItems((current) => sortPeople(current.map((item) => (item.id === updated.id ? updated : item))));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      <div className="card">
        <h2>{editingId ? "Person bearbeiten" : "Neue Person"}</h2>
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label className="field">
              <span>Anrede</span>
              <select
                onChange={(event) => setForm({ ...form, salutation: event.target.value as FormState["salutation"] })}
                value={form.salutation}
              >
                <option value="">–</option>
                {SALUTATIONS.map((salutation) => (
                  <option key={salutation} value={salutation}>
                    {SALUTATION_LABELS[salutation]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Vorname</span>
              <input maxLength={120} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required value={form.firstName} />
            </label>
            <label className="field">
              <span>Nachname</span>
              <input maxLength={120} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required value={form.lastName} />
            </label>
            <label className="field">
              <span>E-Mail</span>
              <input onChange={(event) => setForm({ ...form, email: event.target.value })} required type="email" value={form.email} />
            </label>
            <label className="field">
              <span>Telefon 1</span>
              <input maxLength={40} onChange={(event) => setForm({ ...form, phone1: event.target.value })} value={form.phone1} />
            </label>
            <label className="field">
              <span>Telefon 2</span>
              <input maxLength={40} onChange={(event) => setForm({ ...form, phone2: event.target.value })} value={form.phone2} />
            </label>
            <label className="field">
              <span>Strasse</span>
              <input maxLength={200} onChange={(event) => setForm({ ...form, street: event.target.value })} value={form.street} />
            </label>
            <label className="field">
              <span>PLZ</span>
              <input maxLength={20} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} value={form.postalCode} />
            </label>
            <label className="field">
              <span>Ort</span>
              <input maxLength={120} onChange={(event) => setForm({ ...form, city: event.target.value })} value={form.city} />
            </label>
            <label className="field">
              <span>Adresszusatz</span>
              <input maxLength={200} onChange={(event) => setForm({ ...form, addressExtra: event.target.value })} value={form.addressExtra} />
            </label>
            <label className="field">
              <span>{editingId ? "Neues Passwort (optional)" : "Startpasswort"}</span>
              <input
                autoComplete="new-password"
                minLength={12}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required={!editingId}
                type="password"
                value={form.password}
              />
            </label>
          </div>

          <div className="field field--full" style={{ marginTop: "0.9rem" }}>
            <span>Rollen</span>
            <div className="checkbox-grid">
              {ROLES.map((role) => (
                <label className="checkbox" key={role}>
                  <input checked={form.roles.includes(role)} onChange={() => toggleRole(role)} type="checkbox" />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
          </div>

          <div className="field field--full" style={{ marginTop: "0.6rem" }}>
            <span>Kontaktkanäle</span>
            <div className="checkbox-grid">
              <label className="checkbox">
                <input checked={form.whatsappOk} onChange={(event) => setForm({ ...form, whatsappOk: event.target.checked })} type="checkbox" />
                WhatsApp erlaubt
              </label>
              <label className="checkbox">
                <input checked={form.signalOk} onChange={(event) => setForm({ ...form, signalOk: event.target.checked })} type="checkbox" />
                Signal erlaubt
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button className="button" disabled={saving} type="submit">
              {saving ? "Speichern …" : editingId ? "Änderungen speichern" : "Person anlegen"}
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
        <h2>{SECTION_LABELS[defaultRole]}</h2>
        {items.length === 0 ? (
          <p className="empty">Noch keine Personen erfasst.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Rollen</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((person) => (
                <tr key={person.id}>
                  <td>
                    {person.salutation ? `${SALUTATION_LABELS[person.salutation]} ` : ""}
                    {person.firstName} {person.lastName}
                  </td>
                  <td>{person.email}</td>
                  <td>{person.roles.map((role) => ROLE_LABELS[role]).join(", ")}</td>
                  <td>
                    <span className={`badge ${person.active ? "badge--active" : "badge--inactive"}`}>
                      {person.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button button--secondary button--small" onClick={() => startEdit(person)} type="button">
                        Bearbeiten
                      </button>
                      <button className="button button--secondary button--small" onClick={() => void toggleActive(person)} type="button">
                        {person.active ? "Deaktivieren" : "Aktivieren"}
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
