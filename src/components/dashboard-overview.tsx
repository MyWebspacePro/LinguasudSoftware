"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Course = { id: string; status: "planned" | "active" | "paused" | "completed" | "cancelled" };
type Participant = { id: string };
type Room = { id: string };
type BillingEnrollment = {
  enrollment_id: string;
  billing_type: "private" | "authority";
  lowCredit: boolean;
  billableConfirmedLessons: number;
};

type DashboardData = {
  courses: Course[];
  participants: Participant[];
  rooms: Room[];
  billingEnrollments: BillingEnrollment[];
};

function responseError(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

export function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);

    try {
      const [coursesResponse, participantsResponse, roomsResponse, billingResponse] = await Promise.all([
        fetch("/api/courses", { cache: "no-store", credentials: "same-origin", signal }),
        fetch("/api/users?role=participant", { cache: "no-store", credentials: "same-origin", signal }),
        fetch("/api/rooms", { cache: "no-store", credentials: "same-origin", signal }),
        fetch("/api/billing/overview", { cache: "no-store", credentials: "same-origin", signal }),
      ]);
      const [coursesPayload, participantsPayload, roomsPayload, billingPayload] = await Promise.all([
        coursesResponse.json(),
        participantsResponse.json(),
        roomsResponse.json(),
        billingResponse.json(),
      ]);

      if (!coursesResponse.ok) throw new Error(responseError(coursesPayload, "Kurse konnten nicht geladen werden."));
      if (!participantsResponse.ok) throw new Error(responseError(participantsPayload, "Teilnehmer konnten nicht geladen werden."));
      if (!roomsResponse.ok) throw new Error(responseError(roomsPayload, "Räume konnten nicht geladen werden."));
      if (!billingResponse.ok) throw new Error(responseError(billingPayload, "Abrechnungsübersicht konnte nicht geladen werden."));
      if (signal?.aborted) return;

      setData({
        courses: (coursesPayload as { courses: Course[] }).courses,
        participants: (participantsPayload as { users: Participant[] }).users,
        rooms: (roomsPayload as { rooms: Room[] }).rooms,
        billingEnrollments: (billingPayload as { enrollments: BillingEnrollment[] }).enrollments,
      });
    } catch (loadError) {
      if (signal?.aborted) return;
      setError(loadError instanceof Error ? loadError.message : "Dashboard konnte nicht geladen werden.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal));
    return () => controller.abort();
  }, [load]);

  const summary = useMemo(() => {
    const courses = data?.courses ?? [];
    const billingEnrollments = data?.billingEnrollments ?? [];
    return {
      openCourses: courses.filter((course) => course.status !== "completed" && course.status !== "cancelled").length,
      participants: data?.participants.length ?? 0,
      rooms: data?.rooms.length ?? 0,
      lowCredit: billingEnrollments.filter((enrollment) => enrollment.lowCredit).length,
      authorityLessons: billingEnrollments
        .filter((enrollment) => enrollment.billing_type === "authority")
        .reduce((total, enrollment) => total + enrollment.billableConfirmedLessons, 0),
      activeEnrollments: billingEnrollments.length,
    };
  }, [data]);

  const isEmpty = data !== null
    && summary.openCourses === 0
    && summary.participants === 0
    && summary.rooms === 0
    && summary.activeEnrollments === 0;

  return <section className="dashboard-overview" aria-labelledby="dashboard-overview-title">
    <div className="dashboard-overview__head">
      <div>
        <p className="eyebrow">Übersicht</p>
        <h2 id="dashboard-overview-title">Tagesstatus</h2>
      </div>
      <button className="quiet-button" disabled={isLoading} onClick={() => void load()} type="button">
        {isLoading ? "Aktualisiert …" : "Aktualisieren"}
      </button>
    </div>

    {error ? <div className="planner-state" role="alert"><span>{error}</span><button className="quiet-button" onClick={() => void load()} type="button">Erneut versuchen</button></div> : null}
    {isLoading && data === null ? <p className="planner-state" role="status">Dashboard wird geladen …</p> : null}
    {!isLoading && !error && isEmpty ? <p className="planner-state">Noch keine Verwaltungsdaten vorhanden. Lege zuerst Räume, Lehrpersonen, Kurse und Teilnehmer an.</p> : null}
    {data !== null ? <>
      <div className="dashboard-kpi-strip" aria-label="Dashboard-Kennzahlen">
        <article aria-label={`Laufende Kurse: ${summary.openCourses}`}><span>Laufende Kurse</span><strong>{summary.openCourses}</strong></article>
        <article aria-label={`Teilnehmer: ${summary.participants}`}><span>Teilnehmer</span><strong>{summary.participants}</strong></article>
        <article aria-label={`Aktive Räume: ${summary.rooms}`}><span>Aktive Räume</span><strong>{summary.rooms}</strong></article>
        <article aria-label={`Guthaben niedrig: ${summary.lowCredit}`}><span>Guthaben niedrig</span><strong>{summary.lowCredit}</strong></article>
      </div>
      <div className="billing-summary" aria-label="Abrechnungsstatus">
        <span>{summary.activeEnrollments} aktive Teilnahmen</span>
        <span>{summary.authorityLessons} bestätigte Lektionen für Kostenträger</span>
      </div>
    </> : null}
  </section>;
}
