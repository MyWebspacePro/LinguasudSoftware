"use client";

import { type FormEvent, useEffect, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { TARIFFS } from "@/lib/types";
import type { CourseSizeKind, PriceList, PriceListItem, Tariff } from "@/lib/types";

const TARIFF_LABELS: Record<Tariff, string> = { normal: "Normaltarif", low: "Niedertarif" };
const DURATIONS = [45, 60, 75, 90, 120, 150, 180];

export function PriceListManager({
  initialPriceLists,
  sizeKinds,
}: {
  initialPriceLists: PriceList[];
  sizeKinds: CourseSizeKind[];
}) {
  const [lists, setLists] = useState(initialPriceLists);
  const [selectedId, setSelectedId] = useState<string | null>(initialPriceLists[0]?.id ?? null);
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: "Preise " + new Date().getFullYear(),
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: "",
  });

  const [itemForm, setItemForm] = useState({
    courseSizeKindId: sizeKinds[0]?.id ?? "",
    durationMinutes: "90",
    tariff: "normal" as Tariff,
    minLessons: "14",
    packageLessons: "14",
    priceChf: "",
  });

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void (async () => {
      setError(null);
      try {
        const detail = await api.get<{ priceList: PriceList; items: PriceListItem[] }>(`/api/price-lists/${selectedId}`);
        if (active) setItems(detail.items);
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId]);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { priceList } = await api.post<{ priceList: PriceList }>("/api/price-lists", {
        name: createForm.name.trim(),
        validFrom: createForm.validFrom,
        validTo: createForm.validTo || null,
      });
      setLists((current) => [priceList, ...current]);
      setNotice("Preisliste angelegt.");
      setSelectedId(priceList.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) {
      setError("Bitte zuerst eine Preisliste auswählen.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { item } = await api.post<{ item: PriceListItem }>(`/api/price-lists/${selectedId}/items`, {
        courseSizeKindId: itemForm.courseSizeKindId,
        durationMinutes: Number(itemForm.durationMinutes),
        tariff: itemForm.tariff,
        minLessons: Number(itemForm.minLessons),
        packageLessons: itemForm.packageLessons ? Number(itemForm.packageLessons) : null,
        priceChf: Number(itemForm.priceChf),
      });
      setItems((current) => [...current, item]);
      setNotice("Preisposition angelegt.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: PriceListItem) {
    if (!selectedId) return;
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/api/price-lists/${selectedId}/items/${item.id}`);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice("Preisposition entfernt.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const canCreateItems = sizeKinds.length > 0 && lists.length > 0;

  return (
    <>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="card">
        <h2>Neue Preisliste</h2>
        <form onSubmit={(event) => void submitCreate(event)}>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input maxLength={120} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} required value={createForm.name} />
            </label>
            <label className="field">
              <span>Gültig ab</span>
              <input onChange={(event) => setCreateForm({ ...createForm, validFrom: event.target.value })} required type="date" value={createForm.validFrom} />
            </label>
            <label className="field">
              <span>Gültig bis (optional)</span>
              <input onChange={(event) => setCreateForm({ ...createForm, validTo: event.target.value })} type="date" value={createForm.validTo} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button" disabled={saving} type="submit">
              Preisliste anlegen
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>Preisliste auswählen</h2>
          <select onChange={(event) => setSelectedId(event.target.value || null)} value={selectedId ?? ""}>
            <option value="">–</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} (ab {list.validFrom})
              </option>
            ))}
          </select>
        </div>

        {selectedId && canCreateItems ? (
          <>
            <h3>Preisposition hinzufügen</h3>
            <form onSubmit={(event) => void submitItem(event)}>
              <div className="form-grid">
                <label className="field">
                  <span>Kursart</span>
                  <select onChange={(event) => setItemForm({ ...itemForm, courseSizeKindId: event.target.value })} value={itemForm.courseSizeKindId}>
                    {sizeKinds.map((kind) => (
                      <option key={kind.id} value={kind.id}>
                        {kind.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Dauer (Min.)</span>
                  <select onChange={(event) => setItemForm({ ...itemForm, durationMinutes: event.target.value })} value={itemForm.durationMinutes}>
                    {DURATIONS.map((duration) => (
                      <option key={duration} value={String(duration)}>
                        {duration}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Tarif</span>
                  <select onChange={(event) => setItemForm({ ...itemForm, tariff: event.target.value as Tariff })} value={itemForm.tariff}>
                    {TARIFFS.map((tariff) => (
                      <option key={tariff} value={tariff}>
                        {TARIFF_LABELS[tariff]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Ab Lektionen</span>
                  <input min={1} onChange={(event) => setItemForm({ ...itemForm, minLessons: event.target.value })} type="number" value={itemForm.minLessons} />
                </label>
                <label className="field">
                  <span>Paket-Lektionen (optional)</span>
                  <input min={1} onChange={(event) => setItemForm({ ...itemForm, packageLessons: event.target.value })} type="number" value={itemForm.packageLessons} />
                </label>
                <label className="field">
                  <span>Preis CHF</span>
                  <input min={0} onChange={(event) => setItemForm({ ...itemForm, priceChf: event.target.value })} required step="0.05" type="number" value={itemForm.priceChf} />
                </label>
              </div>
              <div className="form-actions">
                <button className="button" disabled={saving} type="submit">
                  Preisposition hinzufügen
                </button>
              </div>
            </form>

            <table className="data" style={{ marginTop: "1rem" }}>
              <thead>
                <tr>
                  <th>Kursart</th>
                  <th>Dauer</th>
                  <th>Tarif</th>
                  <th>Ab Lektionen</th>
                  <th>Paket</th>
                  <th>Preis</th>
                  <th aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.courseSizeKindName}</td>
                    <td>{item.durationMinutes} Min.</td>
                    <td>{TARIFF_LABELS[item.tariff]}</td>
                    <td>{item.minLessons}</td>
                    <td>{item.packageLessons ?? "–"}</td>
                    <td>{item.priceChf.toFixed(2)} CHF</td>
                    <td>
                      <div className="row-actions">
                        <button className="button button--danger button--small" onClick={() => void removeItem(item)} type="button">
                          Entfernen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? <p className="empty">Noch keine Preispositionen.</p> : null}
          </>
        ) : (
          <p className="empty">Bitte eine Preisliste wählen (und Kursarten anlegen).</p>
        )}
      </div>
    </>
  );
}
