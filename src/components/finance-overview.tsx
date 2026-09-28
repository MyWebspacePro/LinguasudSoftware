"use client";

import { useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { FinanceOverview, InvoiceKind } from "@/lib/types";

const KIND_LABELS: Record<InvoiceKind, string> = { package: "Paket", monthly: "Monatlich", other: "Sonstige" };

export function FinanceOverviewPanel({ initialOverview }: { initialOverview: FinanceOverview }) {
  const [overview, setOverview] = useState(initialOverview);
  const [period, setPeriod] = useState(initialOverview.period);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await api.get<{ overview: FinanceOverview }>(`/api/finance/overview?period=${period}`);
      setOverview(data.overview);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      <div className="toolbar">
        <label className="field">
          <span>Periode</span>
          <input onChange={(event) => setPeriod(event.target.value)} type="month" value={period} />
        </label>
        <button className="button button--secondary" onClick={() => void load()} type="button">
          Anzeigen
        </button>
      </div>
      <div className="grid-cards">
        <div className="stat">
          <div className="stat__value">{overview.revenueChf.toFixed(2)}</div>
          <div className="stat__label">Umsatz CHF (bezahlt)</div>
        </div>
        <div className="stat">
          <div className="stat__value">{overview.openChf.toFixed(2)}</div>
          <div className="stat__label">Offene Beträge CHF</div>
        </div>
        <div className="stat">
          <div className="stat__value">{overview.honorarChf.toFixed(2)}</div>
          <div className="stat__label">Honorare CHF</div>
        </div>
        <div className="stat">
          <div className="stat__value">{overview.invoiceCount}</div>
          <div className="stat__label">Rechnungen ({overview.paidCount} bezahlt, {overview.openCount} offen)</div>
        </div>
      </div>

      <div className="card">
        <h2>Umsatz nach Art</h2>
        {overview.revenueByKind.length === 0 ? (
          <p className="empty">Keine Daten für diese Periode.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Art</th>
                <th>Umsatz CHF</th>
              </tr>
            </thead>
            <tbody>
              {overview.revenueByKind.map((entry) => (
                <tr key={entry.kind}>
                  <td>{KIND_LABELS[entry.kind]}</td>
                  <td>{entry.amountChf.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
