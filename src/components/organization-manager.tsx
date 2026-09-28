"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { ORGANIZATION_KINDS, type Organization, type OrganizationKind } from "@/lib/types";

const KIND_LABELS: Record<OrganizationKind, string> = {
  company: "Firma",
  authority: "Behörde",
  parent: "Eltern",
  other: "Andere",
};

type FormState = {
  kind: OrganizationKind;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  customerNumber: string;
  invoiceRecipient: string;
  notes: string;
};

const emptyForm: FormState = {
  kind: "company",
  name: "",
  contactName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  customerNumber: "",
  invoiceRecipient: "",
  notes: "",
};

function sortOrganizations(list: Organization[]): Organization[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function OrganizationManager({ initialOrganizations }: { initialOrganizations: Organization[] }) {
  const [items, setItems] = useState(() => sortOrganizations(initialOrganizations));
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

  function startEdit(organization: Organization) {
    setEditingId(organization.id);
    setForm({
      kind: organization.kind,
      name: organization.name,
      contactName: organization.contactName ?? "",
      email: organization.email ?? "",
      phone: organization.phone ?? "",
      street: organization.street ?? "",
      postalCode: organization.postalCode ?? "",
      city: organization.city ?? "",
      customerNumber: organization.customerNumber ?? "",
      invoiceRecipient: organization.invoiceRecipient ?? "",
      notes: organization.notes ?? "",
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
      kind: form.kind,
      name: form.name.trim(),
      contactName: form.contactName.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      street: form.street.trim() || null,
      postalCode: form.postalCode.trim() || null,
      city: form.city.trim() || null,
      customerNumber: form.customerNumber.trim() || null,
      invoiceRecipient: form.invoiceRecipient.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editingId) {
        const { organization } = await api.patch<{ organization: Organization }>(
          `/api/organizations/${editingId}`,
          payload,
        );
        setItems((current) => sortOrganizations(current.map((item) => (item.id === organization.id ? organization : item))));
        setNotice("Kostenträger aktualisiert.");
      } else {
        const { organization } = await api.post<{ organization: Organization }>("/api/organizations", payload);
        setItems((current) => sortOrganizations([...current, organization]));
        setNotice("Kostenträger angelegt.");
      }
      reset();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(organization: Organization) {
    setError(null);
    setNotice(null);
    try {
      const { organization: updated } = await api.patch<{ organization: Organization }>(
        `/api/organizations/${organization.id}`,
        { active: !organization.active },
      );
      setItems((current) => sortOrganizations(current.map((item) => (item.id === updated.id ? updated : item))));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      <div className="card">
        <h2>{editingId ? "Kostenträger bearbeiten" : "Neuer Kostenträger"}</h2>
        {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label className="field">
              <span>Art</span>
              <select onChange={(event) => setForm({ ...form, kind: event.target.value as OrganizationKind })} value={form.kind}>
                {ORGANIZATION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Name</span>
              <input maxLength={200} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
            </label>
            <label className="field">
              <span>Kontaktperson</span>
              <input maxLength={200} onChange={(event) => setForm({ ...form, contactName: event.target.value })} value={form.contactName} />
            </label>
            <label className="field">
              <span>E-Mail</span>
              <input onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" value={form.email} />
            </label>
            <label className="field">
              <span>Telefon</span>
              <input maxLength={60} onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} />
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
              <span>Kundennummer</span>
              <input maxLength={60} onChange={(event) => setForm({ ...form, customerNumber: event.target.value })} value={form.customerNumber} />
            </label>
            <label className="field">
              <span>Rechnungsempfänger</span>
              <input
                maxLength={200}
                onChange={(event) => setForm({ ...form, invoiceRecipient: event.target.value })}
                value={form.invoiceRecipient}
              />
            </label>
            <label className="field field--full">
              <span>Notizen</span>
              <textarea maxLength={4000} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} value={form.notes} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button" disabled={saving} type="submit">
              {saving ? "Speichern …" : editingId ? "Änderungen speichern" : "Kostenträger anlegen"}
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
        <h2>Kostenträger</h2>
        {items.length === 0 ? (
          <p className="empty">Noch keine Kostenträger erfasst.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Art</th>
                <th>Ort</th>
                <th>Kundennr.</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((organization) => (
                <tr key={organization.id}>
                  <td>{organization.name}</td>
                  <td>{KIND_LABELS[organization.kind]}</td>
                  <td>{organization.city ?? "–"}</td>
                  <td>{organization.customerNumber ?? "–"}</td>
                  <td>
                    <span className={`badge ${organization.active ? "badge--active" : "badge--inactive"}`}>
                      {organization.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button button--secondary button--small" onClick={() => startEdit(organization)} type="button">
                        Bearbeiten
                      </button>
                      <button
                        className="button button--secondary button--small"
                        onClick={() => void toggleActive(organization)}
                        type="button"
                      >
                        {organization.active ? "Deaktivieren" : "Aktivieren"}
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
