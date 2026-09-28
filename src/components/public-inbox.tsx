"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { PlacementRecord, PublicInquiry } from "@/lib/public-site";
import type { Person } from "@/lib/types";

type Target = { kind: "inquiry" | "placement"; id: string };

export function PublicInbox({ initialInquiries, initialResults }: {
  initialInquiries: PublicInquiry[];
  initialResults: PlacementRecord[];
}) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [results, setResults] = useState(initialResults);
  const [target, setTarget] = useState<Target | null>(null);
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<Person[]>([]);
  const [participantId, setParticipantId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function findPeople() {
    if (search.trim().length < 2) {
      setError("Mindestens zwei Zeichen für die Personensuche eingeben.");
      return;
    }
    setError(null);
    try {
      const data = await api.get<{ people: Person[] }>(`/api/people?role=participant&limit=20&search=${encodeURIComponent(search.trim())}`);
      setMatches(data.people);
      setParticipantId(data.people[0]?.id ?? "");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || !participantId) return;
    setBusy(true);
    setError(null);
    try {
      if (target.kind === "inquiry") {
        await api.patch(`/api/inquiries/${target.id}`, { participantId, handled: true });
        setInquiries((current) => current.map((entry) => entry.id === target.id ? { ...entry, participantId, handled: true } : entry));
      } else {
        await api.patch(`/api/placement/records/${target.id}`, { participantId });
        setResults((current) => current.map((entry) => entry.id === target.id ? { ...entry, participantId } : entry));
      }
      setNotice("Zuordnung gespeichert.");
      setTarget(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function markHandled(id: string) {
    setError(null);
    try {
      await api.patch(`/api/inquiries/${id}`, { handled: true });
      setInquiries((current) => current.map((entry) => entry.id === id ? { ...entry, handled: true } : entry));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function begin(kind: Target["kind"], id: string, email: string) {
    setTarget({ kind, id });
    setSearch(email);
    setMatches([]);
    setParticipantId("");
    setNotice(null);
  }

  return (
    <>
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      {notice ? <p className="alert alert--success" role="status">{notice}</p> : null}
      {target ? (
        <div className="card">
          <h2>Person nach Prüfung zuordnen</h2>
          <p>Der eingegebene E-Mail-Absender ist nicht verifiziert. Bitte die Identität prüfen, bevor du zuordnest.</p>
          <div className="toolbar"><label className="field"><span>Person suchen</span><input onChange={(event) => setSearch(event.target.value)} value={search} /></label>
            <button className="button button--secondary" onClick={() => void findPeople()} type="button">Suchen</button>
          </div>
          {matches.length > 0 ? (
            <form onSubmit={(event) => void assign(event)}>
              <label className="field"><span>Teilnehmende Person</span><select onChange={(event) => setParticipantId(event.target.value)} value={participantId}>
                {matches.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName} · {person.email}</option>)}
              </select></label>
              <div className="form-actions"><button className="button" disabled={busy} type="submit">Zuordnen</button>
                <button className="button button--secondary" onClick={() => setTarget(null)} type="button">Abbrechen</button></div>
            </form>
          ) : <p>Suche nach Namen oder E-Mail, um eine vorhandene Person zu wählen.</p>}
        </div>
      ) : null}
      <div className="card"><h2>Anfragen</h2>
        {inquiries.length === 0 ? <p className="empty">Keine Anfragen.</p> : (
          <div className="public-admin-list">
            {inquiries.map((entry) => (
              <article key={entry.id}>
                <h3>{entry.firstName} {entry.lastName} · {entry.handled ? "Bearbeitet" : "Offen"}</h3>
                <p>{entry.email}{entry.phone ? ` · ${entry.phone}` : ""} · {entry.language ?? "Sprache offen"} · {entry.courseForm ?? "Unterrichtsform offen"}</p>
                {entry.message ? <p>{entry.message}</p> : null}
                <p>Zuordnung: {entry.participantId ? "vorhanden" : "offen"} · {new Date(entry.createdAt).toLocaleString("de-CH")}</p>
                <div className="form-actions">
                  <button className="button button--secondary button--small" onClick={() => begin("inquiry", entry.id, entry.email)} type="button">Person zuordnen</button>
                  {!entry.handled ? <button className="button button--secondary button--small" onClick={() => void markHandled(entry.id)} type="button">Als bearbeitet markieren</button> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="card"><h2>Deutsch-Einstufungen</h2>
        {results.length === 0 ? <p className="empty">Keine Ergebnisse.</p> : (
          <div className="public-admin-list">
            {results.map((entry) => (
              <article key={entry.id}>
                <h3>{entry.firstName} {entry.lastName} · Orientierung {entry.resultLevel ?? "offen"}</h3>
                <p>{entry.email} · Zuordnung: {entry.participantId ? "vorhanden" : "offen"}</p>
                <button className="button button--secondary button--small" onClick={() => begin("placement", entry.id, entry.email)} type="button">Person zuordnen</button>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
