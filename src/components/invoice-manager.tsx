"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { INVOICE_KINDS, INVOICE_STATUSES } from "@/lib/types";
import type { Invoice, InvoiceKind, InvoiceStatus, Organization } from "@/lib/types";

const KIND_LABELS: Record<InvoiceKind, string> = { package: "Paket", monthly: "Monatlich", other: "Sonstige" };
const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Entwurf",
  sent: "Versendet",
  paid: "Bezahlt",
  overdue: "Überfällig",
  cancelled: "Storniert",
};

export function InvoiceManager({
  initialInvoices,
  organizations,
}: {
  initialInvoices: Invoice[];
  organizations: Organization[];
}) {
  const [items, setItems] = useState(initialInvoices);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [periodFilter, setPeriodFilter] = useState("");
  const [form, setForm] = useState({
    organizationId: "",
    kind: "monthly" as InvoiceKind,
    number: "",
    amountChf: "",
    status: "draft" as InvoiceStatus,
    issuedOn: new Date().toISOString().slice(0, 10),
    dueOn: "",
    period: new Date().toISOString().slice(0, 7),
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { invoice } = await api.post<{ invoice: Invoice }>("/api/invoices", {
        organizationId: form.organizationId || null,
        kind: form.kind,
        number: form.number.trim() || null,
        amountChf: Number(form.amountChf),
        status: form.status,
        issuedOn: form.issuedOn || null,
        dueOn: form.dueOn || null,
        period: form.period || null,
      });
      setItems((current) => [invoice, ...current]);
      setNotice("Rechnung angelegt.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function patch(invoice: Invoice, body: Record<string, unknown>, message: string) {
    setError(null);
    setNotice(null);
    try {
      const data = await api.patch<{ invoice: Invoice }>(`/api/invoices/${invoice.id}`, body);
      setItems((current) => current.map((item) => (item.id === data.invoice.id ? data.invoice : item)));
      setNotice(message);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function filter() {
    setError(null);
    try {
      const query = periodFilter ? `?period=${periodFilter}` : "";
      const data = await api.get<{ invoices: Invoice[] }>(`/api/invoices${query}`);
      setItems(data.invoices);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="card">
        <h2>Neue Rechnung</h2>
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label className="field">
              <span>Kostenträger (optional)</span>
              <select onChange={(event) => setForm({ ...form, organizationId: event.target.value })} value={form.organizationId}>
                <option value="">–</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Art</span>
              <select onChange={(event) => setForm({ ...form, kind: event.target.value as InvoiceKind })} value={form.kind}>
                {INVOICE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Betrag CHF</span>
              <input min={0} onChange={(event) => setForm({ ...form, amountChf: event.target.value })} required step="0.05" type="number" value={form.amountChf} />
            </label>
            <label className="field">
              <span>Nummer (optional)</span>
              <input onChange={(event) => setForm({ ...form, number: event.target.value })} value={form.number} />
            </label>
            <label className="field">
              <span>Periode</span>
              <input onChange={(event) => setForm({ ...form, period: event.target.value })} type="month" value={form.period} />
            </label>
            <label className="field">
              <span>Rechnungsdatum</span>
              <input onChange={(event) => setForm({ ...form, issuedOn: event.target.value })} type="date" value={form.issuedOn} />
            </label>
            <label className="field">
              <span>Fällig am</span>
              <input onChange={(event) => setForm({ ...form, dueOn: event.target.value })} type="date" value={form.dueOn} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button" disabled={saving} type="submit">
              Rechnung anlegen
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>Rechnungen</h2>
          <input onChange={(event) => setPeriodFilter(event.target.value)} type="month" value={periodFilter} />
          <button className="button button--secondary button--small" onClick={() => void filter()} type="button">
            Filtern
          </button>
        </div>
        {items.length === 0 ? (
          <p className="empty">Keine Rechnungen.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Kostenträger</th>
                <th>Art</th>
                <th>Betrag</th>
                <th>Periode</th>
                <th>Status</th>
                <th>Status ändern</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.organizationName ?? "–"}</td>
                  <td>{KIND_LABELS[invoice.kind]}</td>
                  <td>{invoice.amountChf.toFixed(2)} CHF</td>
                  <td>{invoice.period ?? "–"}</td>
                  <td>
                    <span className={`badge ${invoice.status === "paid" ? "badge--active" : "badge--inactive"}`}>
                      {STATUS_LABELS[invoice.status]}
                    </span>
                  </td>
                  <td>
                    <select onChange={(event) => void patch(invoice, { status: event.target.value }, "Status aktualisiert.")} value={invoice.status}>
                      {INVOICE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="button button--secondary button--small"
                        onClick={() => void patch(invoice, { sync: true }, "bexio-Synchronisation ausgelöst.")}
                        type="button"
                      >
                        bexio
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
