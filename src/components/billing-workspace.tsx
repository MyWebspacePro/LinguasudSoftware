"use client";

import { useEffect, useMemo, useState } from "react";

type BillingEnrollment = {
  enrollment_id: string;
  billing_type: "private" | "authority";
  credit_lessons: number | null;
  participant_name: string;
  course_code: string;
  consumedLessons: number;
  remainingLessons: number | null;
  lowCredit: boolean;
  billableConfirmedLessons: number;
};

function errorMessage(payload: unknown) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "Abrechnungsübersicht konnte nicht geladen werden.";
}

export function BillingWorkspace() {
  const [items, setItems] = useState<BillingEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/overview", { credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload));
      setItems((payload as { enrollments: BillingEnrollment[] }).enrollments);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Abrechnungsübersicht konnte nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { queueMicrotask(() => void load()); }, []);

  const summary = useMemo(() => ({
    lowCredit: items.filter((item) => item.lowCredit).length,
    authorityLessons: items.filter((item) => item.billing_type === "authority").reduce((sum, item) => sum + item.billableConfirmedLessons, 0),
    privateItems: items.filter((item) => item.billing_type === "private").length,
  }), [items]);

  return <section className="management-preview" aria-labelledby="billing-title">
    <div className="preview-intro"><p className="eyebrow">Abrechnung & Guthaben</p><h2 id="billing-title">Abrechnung <span>{items.length}</span></h2><p>Private Guthaben werden mit bestätigten Anwesenheiten verrechnet. Bei Kostenträgern sind nur bestätigte Lektionen abrechnungsbereit.</p><div className="billing-summary"><span>{summary.lowCredit} Guthaben niedrig</span><span>{summary.authorityLessons} Lektionen Kostenträger</span><span>{summary.privateItems} private Teilnahmen</span></div></div>
    {error ? <div className="planner-state" role="alert"><span>{error}</span><button className="quiet-button" onClick={() => void load()} type="button">Erneut versuchen</button></div> : null}
    {isLoading ? <p className="planner-state">Abrechnung wird geladen …</p> : <div className="billing-list">{items.length === 0 ? <p className="planner-state">Noch keine aktiven Kursteilnahmen vorhanden.</p> : items.map((item) => <article className={item.lowCredit ? "is-low-credit" : ""} key={item.enrollment_id}><div><span>{item.billing_type === "private" ? "Privat" : "Kostenträger"}</span><h3>{item.participant_name}</h3><p>{item.course_code}</p></div>{item.billing_type === "private" ? <div><strong>{item.remainingLessons ?? 0} Lektionen</strong><p>{item.consumedLessons} von {item.credit_lessons ?? 0} bezogen</p></div> : <div><strong>{item.billableConfirmedLessons} Lektionen</strong><p>bestätigt & abrechnungsbereit</p></div>}</article>)}</div>}
  </section>;
}
