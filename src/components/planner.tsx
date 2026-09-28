"use client";

import { type DragEvent, useEffect, useMemo, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { AttendancePanel } from "@/components/attendance-panel";
import type { Lesson, Location, Room, RoomRental } from "@/lib/types";

const DAY_START = 6 * 60 + 30;
const DAY_END = 22 * 60 + 30;
const SLOT = 15;
const SLOT_HEIGHT = 26;

type RentalBlock = { id: string; title: string; startMinutes: number; endMinutes: number; roomId: string };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function zurichMinutes(iso: string): number {
  const parts = new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function minutesToTime(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

function shiftDate(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return isoDate(next);
}

function weekRange(date: string): { from: string; to: string } {
  const current = new Date(`${date}T00:00:00Z`);
  const day = (current.getUTCDay() + 6) % 7;
  const from = shiftDate(date, -day);
  return { from, to: shiftDate(from, 6) };
}

function rentalToBlock(rental: RoomRental, date: string): RentalBlock | null {
  if (rental.kind === "one_time" && rental.startsAt) {
    if (isoDate(new Date(rental.startsAt)) !== date) return null;
    const start = zurichMinutes(rental.startsAt);
    const end = rental.endsAt ? zurichMinutes(rental.endsAt) : start + 60;
    return { id: rental.id, title: rental.title, startMinutes: start, endMinutes: end, roomId: rental.roomId };
  }
  if (rental.kind === "series" && rental.weekday !== null && rental.startTime && rental.endTime) {
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 7) % 7;
    if (weekday !== rental.weekday) return null;
    if (date < rental.startsOn) return null;
    if (rental.endsOn && date > rental.endsOn) return null;
    const [sh, sm] = rental.startTime.split(":").map(Number);
    const [eh, em] = rental.endTime.split(":").map(Number);
    return { id: rental.id, title: rental.title, startMinutes: sh * 60 + sm, endMinutes: eh * 60 + em, roomId: rental.roomId };
  }
  return null;
}

export function Planner({ locations, rooms, canDecide }: { locations: Location[]; rooms: Room[]; canDecide: boolean }) {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [rentals, setRentals] = useState<RoomRental[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const groups = useMemo(() => {
    return locations
      .map((location) => ({ location, rooms: rooms.filter((room) => room.locationId === location.id) }))
      .filter((group) => group.rooms.length > 0);
  }, [locations, rooms]);

  const slots = useMemo(() => {
    const values: number[] = [];
    for (let minute = DAY_START; minute <= DAY_END; minute += SLOT) values.push(minute);
    return values;
  }, []);

  const rentalBlocks = useMemo(
    () => rentals.map((rental) => rentalToBlock(rental, date)).filter((block): block is RentalBlock => block !== null),
    [rentals, date],
  );

  const selected = lessons.find((lesson) => lesson.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;
    void (async () => {
      setError(null);
      try {
        const [lessonData, rentalData] = await Promise.all([
          api.get<{ lessons: Lesson[] }>(`/api/lessons?date=${date}`),
          api.get<{ rentals: RoomRental[] }>(`/api/room-rentals?date=${date}`),
        ]);
        if (!active) return;
        setLessons(lessonData.lessons);
        setRentals(rentalData.rentals);
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      }
    })();
    return () => {
      active = false;
    };
  }, [date]);

  function replaceLesson(lesson: Lesson) {
    setLessons((current) => current.map((item) => (item.id === lesson.id ? lesson : item)));
  }

  async function refreshLessons() {
    try {
      const data = await api.get<{ lessons: Lesson[] }>(`/api/lessons?date=${date}`);
      setLessons(data.lessons);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function moveLesson(lessonId: string, roomId: string, minutes: number) {
    setError(null);
    setNotice(null);
    try {
      const { lesson } = await api.patch<{ lesson: Lesson }>(`/api/lessons/${lessonId}`, {
        roomId,
        date,
        minutes,
        isProvisional: true,
      });
      replaceLesson(lesson);
      setNotice("Änderung ist vorläufig. Erst beim Fixieren wird sie sichtbar.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function patchLesson(lessonId: string, patch: Record<string, unknown>, message: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { lesson } = await api.patch<{ lesson: Lesson }>(`/api/lessons/${lessonId}`, patch);
      replaceLesson(lesson);
      setNotice(message);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function fixAll() {
    const provisional = lessons.filter((lesson) => lesson.isProvisional);
    if (provisional.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const lesson of provisional) {
        const { lesson: updated } = await api.patch<{ lesson: Lesson }>(`/api/lessons/${lesson.id}`, { isProvisional: false });
        replaceLesson(updated);
      }
      setNotice(`${provisional.length} Änderungen fixiert.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const { from, to } = weekRange(date);
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ created: number }>("/api/lessons/generate", { from, to });
      setNotice(`${result.created} Lektionen für die Woche generiert.`);
      const lessonData = await api.get<{ lessons: Lesson[] }>(`/api/lessons?date=${date}`);
      setLessons(lessonData.lessons);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>, roomId: string) {
    event.preventDefault();
    const lessonId = dragId ?? event.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!lessonId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - bounds.top;
    const slotIndex = Math.round(offset / SLOT_HEIGHT);
    const minutes = Math.min(DAY_END - SLOT, Math.max(DAY_START, DAY_START + slotIndex * SLOT));
    void moveLesson(lessonId, roomId, minutes);
  }

  const bodyHeight = ((DAY_END - DAY_START) / SLOT) * SLOT_HEIGHT;

  return (
    <>
      <div className="toolbar">
        <button className="button button--secondary button--small" onClick={() => setDate((current) => shiftDate(current, -1))} type="button">
          ‹ Vortag
        </button>
        <input onChange={(event) => event.target.value && setDate(event.target.value)} type="date" value={date} />
        <button className="button button--secondary button--small" onClick={() => setDate((current) => shiftDate(current, 1))} type="button">
          Folgetag ›
        </button>
        <button className="button button--secondary button--small" onClick={() => setDate(isoDate(new Date()))} type="button">
          Heute
        </button>
        <button className="button button--secondary button--small" disabled={busy} onClick={() => void generate()} type="button">
          Woche generieren
        </button>
        <button className="button button--small" disabled={busy} onClick={() => void fixAll()} type="button">
          Alle offenen fixieren
        </button>
      </div>

      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="planner">
        <div className="planner__head">
          <div className="planner__corner" />
          {groups.flatMap((group) =>
            group.rooms.map((room) => (
              <div className="planner__room-head" key={room.id}>
                <span className="planner__location">{group.location.name}</span>
                <span>{room.name}</span>
              </div>
            )),
          )}
        </div>

        <div className="planner__body" style={{ height: bodyHeight }}>
          <div className="planner__times">
            {slots.map((minute) => (
              <div className="planner__time" key={minute} style={{ height: SLOT_HEIGHT }}>
                {minute % 60 === 0 ? minutesToTime(minute) : ""}
              </div>
            ))}
          </div>

          {groups.flatMap((group) =>
            group.rooms.map((room) => (
              <div
                className="planner__col"
                key={room.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, room.id)}
              >
                {slots.map((minute) => (
                  <div className={`planner__slot${minute % 60 === 0 ? " planner__slot--hour" : ""}`} key={minute} style={{ height: SLOT_HEIGHT }} />
                ))}

                {rentalBlocks
                  .filter((block) => block.roomId === room.id)
                  .map((block) => (
                    <div
                      className="planner__rental"
                      key={block.id}
                      style={{
                        top: ((block.startMinutes - DAY_START) / SLOT) * SLOT_HEIGHT,
                        height: Math.max(SLOT_HEIGHT, ((block.endMinutes - block.startMinutes) / SLOT) * SLOT_HEIGHT),
                      }}
                      title={block.title}
                    >
                      {block.title}
                    </div>
                  ))}

                {lessons
                  .filter((lesson) => lesson.roomId === room.id)
                  .map((lesson) => {
                    const start = zurichMinutes(lesson.startsAt);
                    return (
                      <button
                        className={`planner__lesson${lesson.isProvisional ? " is-provisional" : ""}${lesson.status === "cancelled" ? " is-cancelled" : ""}`}
                        draggable
                        key={lesson.id}
                        onClick={() => setSelectedId(lesson.id)}
                        onDragEnd={() => setDragId(null)}
                        onDragStart={(event) => {
                          setDragId(lesson.id);
                          event.dataTransfer.setData("text/plain", lesson.id);
                        }}
                        style={{
                          top: ((start - DAY_START) / SLOT) * SLOT_HEIGHT,
                          height: Math.max(SLOT_HEIGHT, (lesson.durationMinutes / SLOT) * SLOT_HEIGHT),
                        }}
                        type="button"
                      >
                        <strong>{lesson.courseCode}</strong>
                        <span>
                          {minutesToTime(start)} · {lesson.teacherName}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )),
          )}
        </div>
      </div>

      {selected ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>
            {selected.courseCode} · {minutesToTime(zurichMinutes(selected.startsAt))}
          </h2>
          <p className="empty" style={{ padding: 0 }}>
            {selected.languageName} {selected.level} · {selected.teacherName} · Raum {selected.roomName ?? "–"} ·{" "}
            {selected.durationMinutes} Min. · {selected.participantCount} Teilnehmende
            {selected.isProvisional ? " · vorläufig" : ""}
          </p>
          <div className="form-actions">
            {selected.isProvisional ? (
              <button
                className="button button--small"
                disabled={busy}
                onClick={() => void patchLesson(selected.id, { isProvisional: false }, "Lektion fixiert.")}
                type="button"
              >
                Fixieren
              </button>
            ) : null}
            {selected.status !== "cancelled" ? (
              <button
                className="button button--secondary button--small"
                disabled={busy}
                onClick={() => void patchLesson(selected.id, { status: "cancelled" }, "Lektion abgesagt.")}
                type="button"
              >
                Absagen
              </button>
            ) : (
              <button
                className="button button--secondary button--small"
                disabled={busy}
                onClick={() => void patchLesson(selected.id, { status: "scheduled" }, "Lektion wiederhergestellt.")}
                type="button"
              >
                Wiederherstellen
              </button>
            )}
            <button className="button button--secondary button--small" onClick={() => setSelectedId(null)} type="button">
              Schliessen
            </button>
          </div>
          <AttendancePanel canExcuse={canDecide} lessonId={selected.id} onCompleted={() => void refreshLessons()} />
        </div>
      ) : null}
    </>
  );
}
