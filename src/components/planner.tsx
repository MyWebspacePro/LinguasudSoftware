"use client";

import { type DragEvent, useEffect, useMemo, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { AttendancePanel } from "@/components/attendance-panel";
import type { Lesson, Location, Room, RoomRental } from "@/lib/types";

const DAY_START = 6 * 60 + 30;
const DAY_END = 22 * 60 + 30;
const SLOT = 15;
const VISIBLE_DAYS = 14;

type RentalBlock = {
  id: string;
  date: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  roomId: string;
  roomName: string;
  locationName: string;
};

type CellEntries = { lessons: Lesson[]; rentals: RentalBlock[] };

function localDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}

function zurichDate(iso: string): string {
  return localDate(new Date(iso));
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

function formatDay(date: string, weekday: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    weekday,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatWeekday(date: string): string {
  return new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", weekday: "short" })
    .format(new Date(`${date}T12:00:00Z`));
}

function formatWeekRange(from: string): string {
  return `${formatDay(from)} – ${formatDay(shiftDate(from, 6))}`;
}

function rentalToBlock(rental: RoomRental, date: string): RentalBlock | null {
  if (rental.kind === "one_time" && rental.startsAt) {
    if (zurichDate(rental.startsAt) !== date) return null;
    const start = zurichMinutes(rental.startsAt);
    const end = rental.endsAt ? zurichMinutes(rental.endsAt) : start + 60;
    return {
      id: rental.id,
      date,
      title: rental.title,
      startMinutes: start,
      endMinutes: end,
      roomId: rental.roomId,
      roomName: rental.roomName,
      locationName: rental.locationName,
    };
  }
  if (rental.kind === "series" && rental.weekday !== null && rental.startTime && rental.endTime) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday !== rental.weekday || date < rental.startsOn || (rental.endsOn && date > rental.endsOn)) return null;
    const [sh, sm] = rental.startTime.split(":").map(Number);
    const [eh, em] = rental.endTime.split(":").map(Number);
    return {
      id: rental.id,
      date,
      title: rental.title,
      startMinutes: sh * 60 + sm,
      endMinutes: eh * 60 + em,
      roomId: rental.roomId,
      roomName: rental.roomName,
      locationName: rental.locationName,
    };
  }
  return null;
}

function cellKey(date: string, roomId: string, minute: number): string {
  return `${date}:${roomId}:${minute}`;
}

export function Planner({ locations, rooms, canDecide }: { locations: Location[]; rooms: Room[]; canDecide: boolean }) {
  const [rangeStart, setRangeStart] = useState(() => mondayOf(localDate(new Date())));
  const [selectedLocationId, setSelectedLocationId] = useState("all");
  const [selectedRoomId, setSelectedRoomId] = useState("all");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [rentals, setRentals] = useState<RoomRental[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const dates = useMemo(() => Array.from({ length: VISIBLE_DAYS }, (_, index) => shiftDate(rangeStart, index)), [rangeStart]);
  const slots = useMemo(() => {
    const values: number[] = [];
    for (let minute = DAY_START; minute < DAY_END; minute += SLOT) values.push(minute);
    return values;
  }, []);
  const availableRooms = useMemo(
    () => rooms.filter((room) => selectedLocationId === "all" || room.locationId === selectedLocationId),
    [rooms, selectedLocationId],
  );
  const roomsInView = useMemo(
    () => availableRooms.filter((room) => selectedRoomId === "all" || room.id === selectedRoomId),
    [availableRooms, selectedRoomId],
  );
  const roomGroups = useMemo(
    () => locations
      .map((location) => ({ location, rooms: roomsInView.filter((room) => room.locationId === location.id) }))
      .filter((group) => group.rooms.length > 0),
    [locations, roomsInView],
  );
  const roomColumns = useMemo(
    () => roomGroups.flatMap((group) => group.rooms),
    [roomGroups],
  );
  const visibleRoomIds = useMemo(
    () => new Set(roomColumns.map((room) => room.id)),
    [roomColumns],
  );
  const rentalBlocks = useMemo(
    () => dates.flatMap((date) => rentals.map((rental) => rentalToBlock(rental, date)).filter((block): block is RentalBlock => block !== null)),
    [dates, rentals],
  );
  const entriesByCell = useMemo(() => {
    const cells = new Map<string, CellEntries>();
    const getCell = (date: string, roomId: string, minute: number) => {
      const key = cellKey(date, roomId, minute);
      let cell = cells.get(key);
      if (!cell) {
        cell = { lessons: [], rentals: [] };
        cells.set(key, cell);
      }
      return cell;
    };
    for (const lesson of lessons) {
      if (!lesson.roomId || !visibleRoomIds.has(lesson.roomId)) continue;
      const date = zurichDate(lesson.startsAt);
      const minute = zurichMinutes(lesson.startsAt);
      if (!dates.includes(date) || minute < DAY_START || minute >= DAY_END) continue;
      const slot = DAY_START + Math.floor((minute - DAY_START) / SLOT) * SLOT;
      getCell(date, lesson.roomId, slot).lessons.push(lesson);
    }
    for (const rental of rentalBlocks) {
      if (!visibleRoomIds.has(rental.roomId) || rental.startMinutes < DAY_START || rental.startMinutes >= DAY_END) continue;
      const slot = DAY_START + Math.floor((rental.startMinutes - DAY_START) / SLOT) * SLOT;
      getCell(rental.date, rental.roomId, slot).rentals.push(rental);
    }
    return cells;
  }, [dates, lessons, rentalBlocks, visibleRoomIds]);
  const selected = lessons.find((lesson) => lesson.id === selectedId) ?? null;

  useEffect(() => {
    let active = true;
    void (async () => {
      setError(null);
      const from = dates[0];
      const to = dates[dates.length - 1];
      try {
        const [lessonData, rentalData] = await Promise.all([
          api.get<{ lessons: Lesson[] }>(`/api/lessons?from=${from}&to=${to}`),
          canDecide ? api.get<{ rentals: RoomRental[] }>(`/api/room-rentals?from=${from}&to=${to}`) : Promise.resolve({ rentals: [] }),
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
  }, [canDecide, dates]);

  function replaceLesson(lesson: Lesson) {
    setLessons((current) => current.map((item) => (item.id === lesson.id ? lesson : item)));
  }

  async function refreshLessons() {
    try {
      const data = await api.get<{ lessons: Lesson[] }>(`/api/lessons?from=${dates[0]}&to=${dates[dates.length - 1]}`);
      setLessons(data.lessons);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function moveLesson(lesson: Lesson, date: string, roomId: string, minute: number) {
    setError(null);
    setNotice(null);
    try {
      const { lesson: updated } = await api.patch<{ lesson: Lesson }>(`/api/lessons/${lesson.id}`, {
        roomId,
        date,
        minutes: minute,
        isProvisional: true,
      });
      replaceLesson(updated);
      setNotice("Änderung ist vorläufig. Erst beim Fixieren wird sie übernommen.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>, date: string, roomId: string, minute: number) {
    event.preventDefault();
    const lessonId = dragId ?? event.dataTransfer.getData("text/plain");
    setDragId(null);
    const lesson = lessons.find((item) => item.id === lessonId);
    if (lesson) void moveLesson(lesson, date, roomId, minute);
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
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ created: number }>("/api/lessons", { from: dates[0], to: dates[dates.length - 1] });
      setNotice(`${result.created} Lektionen für 14 Tage generiert.`);
      const lessonData = await api.get<{ lessons: Lesson[] }>(`/api/lessons?from=${dates[0]}&to=${dates[dates.length - 1]}`);
      setLessons(lessonData.lessons);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const todayWeek = mondayOf(localDate(new Date()));
  const nextWeek = shiftDate(todayWeek, 7);
  const currentWindow = rangeStart === todayWeek;
  const firstWeekLabel = rangeStart === todayWeek ? "Aktuelle Woche" : rangeStart === nextWeek ? "Nächste Woche" : "Woche 1";
  const secondWeekStart = shiftDate(rangeStart, 7);
  const secondWeekLabel = secondWeekStart === todayWeek ? "Aktuelle Woche" : secondWeekStart === nextWeek ? "Nächste Woche" : "Woche 2";

  return (
    <>
      <div className="toolbar planner-toolbar">
        <button className="button button--secondary button--small" onClick={() => setRangeStart((current) => shiftDate(current, -14))} type="button">
          ‹ 2 Wochen
        </button>
        <label className="planner-toolbar__date">Startwoche
          <input
            onChange={(event) => event.target.value && setRangeStart(mondayOf(event.target.value))}
            type="date"
            value={rangeStart}
          />
        </label>
        <button className="button button--secondary button--small" onClick={() => setRangeStart((current) => shiftDate(current, 14))} type="button">
          2 Wochen ›
        </button>
        <button className="button button--secondary button--small" onClick={() => setRangeStart(todayWeek)} type="button">
          Aktuelle + nächste Woche
        </button>
        <label className="planner-toolbar__filter">Standort
          <select onChange={(event) => { setSelectedLocationId(event.target.value); setSelectedRoomId("all"); }} value={selectedLocationId}>
            <option value="all">Alle Standorte</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </label>
        <label className="planner-toolbar__filter">Raum
          <select onChange={(event) => setSelectedRoomId(event.target.value)} value={selectedRoomId}>
            <option value="all">Alle Räume</option>
            {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>
        {canDecide ? (
          <>
            <button className="button button--secondary button--small" disabled={busy} onClick={() => void generate()} type="button">
              14 Tage generieren
            </button>
            <button className="button button--small" disabled={busy || !lessons.some((lesson) => lesson.isProvisional)} onClick={() => void fixAll()} type="button">
              Vorläufige fixieren
            </button>
          </>
        ) : null}
      </div>

      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success" role="status">{notice}</div> : null}

      <div className="planner__viewport" aria-label="Zimmerbelegung für 14 Tage">
        <div className="planner__calendar" style={{ "--planner-column-count": dates.length * roomColumns.length } as React.CSSProperties}>
          <div className="planner__headers">
            <div className="planner__week-head">
              <div className="planner__head-corner" />
              <div className="planner__week-title planner__week-title--current" style={{ gridColumn: `span ${7 * roomColumns.length}` }}>
                <strong>{firstWeekLabel}</strong><span>{formatWeekRange(rangeStart)}</span>
              </div>
              <div className="planner__week-title" style={{ gridColumn: `span ${7 * roomColumns.length}` }}>
                <strong>{secondWeekLabel}</strong><span>{formatWeekRange(secondWeekStart)}</span>
              </div>
            </div>
            <div className="planner__day-head">
              <div className="planner__time-head">Uhrzeit</div>
              {dates.map((date) => (
                <div className={`planner__day-title${date === localDate(new Date()) ? " is-today" : ""}`} key={date} style={{ gridColumn: `span ${roomColumns.length}` }} title={formatDay(date, "long")}>
                  <strong>{formatWeekday(date)}</strong>
                  <span>{date.slice(8, 10)}.{date.slice(5, 7)}.</span>
                </div>
              ))}
              {dates.flatMap((date) => roomGroups.map((group) => (
                <div className="planner__location-title" key={`${date}:${group.location.id}`} style={{ gridColumn: `span ${group.rooms.length}` }}>
                  {group.location.name}
                </div>
              )))}
              {dates.flatMap((date) => roomColumns.map((room) => (
                <div className="planner__room-title" key={`${date}:${room.id}`} title={room.name}>{room.name}</div>
              )))}
            </div>
          </div>
          <div className="planner__body">
            <div className="planner__time-col">
              {slots.map((minute) => (
                <div className={`planner__time${(minute - DAY_START) % 60 === 0 ? " planner__time--hour" : ""}`} key={minute}>
                  {minutesToTime(minute)}
                </div>
              ))}
              <div className="planner__time-end">22:30</div>
            </div>
            {dates.flatMap((date) => roomColumns.map((room) => (
              <div className="planner__room-column" key={`${date}:${room.id}`}>
                {slots.map((minute) => {
                  const entries = entriesByCell.get(cellKey(date, room.id, minute));
                  return (
                    <div
                      aria-label={`${formatDay(date, "long")} ${room.name} ${minutesToTime(minute)}`}
                      className={`planner__slot${(minute - DAY_START) % 60 === 0 ? " planner__slot--hour" : ""}`}
                      key={minute}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => onDrop(event, date, room.id, minute)}
                    >
                      {entries?.lessons.map((lesson) => (
                        <button
                          className={`planner__entry planner__lesson${lesson.isProvisional ? " is-provisional" : ""}${lesson.status === "cancelled" ? " is-cancelled" : ""}`}
                          draggable
                          key={lesson.id}
                          onClick={() => setSelectedId(lesson.id)}
                          onDragEnd={() => setDragId(null)}
                          onDragStart={(event) => {
                            setDragId(lesson.id);
                            event.dataTransfer.setData("text/plain", lesson.id);
                          }}
                          aria-label={`${lesson.courseCode}, ${lesson.languageName} ${lesson.level}, Lehrperson ${lesson.teacherName}, ${lesson.participantCount} Teilnehmende, ${minutesToTime(zurichMinutes(lesson.startsAt))}, ${lesson.roomName ?? "Kein Raum"}`}
                          type="button"
                        >
                          <strong>{lesson.languageName} {lesson.level}</strong>
                          <span>{minutesToTime(zurichMinutes(lesson.startsAt))} · {lesson.teacherName}</span>
                          <span className="planner__tooltip" role="tooltip">
                            <strong>{lesson.courseCode}</strong>
                            <span>{lesson.languageName} {lesson.level}</span>
                            <span>Lehrperson: {lesson.teacherName}</span>
                            <span>Teilnehmende: {lesson.participantCount}</span>
                            <span>{minutesToTime(zurichMinutes(lesson.startsAt))} · {lesson.durationMinutes} Min.</span>
                            <span>Raum: {lesson.roomName ?? "Kein Raum"}</span>
                          </span>
                        </button>
                      ))}
                      {entries?.rentals.map((rental) => (
                        <div className="planner__entry planner__rental" key={rental.id} title={`${rental.title} · ${rental.roomName}`}>
                          <strong>{rental.title}</strong>
                          <span>{minutesToTime(rental.startMinutes)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
                <div className="planner__end-cell" />
              </div>
            )))}
          </div>
        </div>
      </div>

      {currentWindow ? <p className="planner__caption">Ansicht: aktuelle und nächste Woche · 14 Tage · 06:30–22:30 Uhr</p> : null}

      {selected ? (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>{selected.courseCode} · {minutesToTime(zurichMinutes(selected.startsAt))}</h2>
          <p className="empty" style={{ padding: 0 }}>
            {selected.languageName} {selected.level} · {selected.teacherName} · Raum {selected.roomName ?? "–"} ·{" "}
            {selected.durationMinutes} Min. · {selected.participantCount} Teilnehmende{selected.isProvisional ? " · vorläufig" : ""}
          </p>
          <div className="form-actions">
            {selected.isProvisional ? (
              <button className="button button--small" disabled={busy} onClick={() => void patchLesson(selected.id, { isProvisional: false }, "Lektion fixiert.")} type="button">Fixieren</button>
            ) : null}
            {selected.status !== "cancelled" ? (
              <button className="button button--secondary button--small" disabled={busy} onClick={() => void patchLesson(selected.id, { status: "cancelled" }, "Lektion abgesagt.")} type="button">Absagen</button>
            ) : (
              <button className="button button--secondary button--small" disabled={busy} onClick={() => void patchLesson(selected.id, { status: "scheduled" }, "Lektion wiederhergestellt.")} type="button">Wiederherstellen</button>
            )}
            <button className="button button--secondary button--small" onClick={() => setSelectedId(null)} type="button">Schliessen</button>
          </div>
          <AttendancePanel canExcuse={canDecide} lessonId={selected.id} onCompleted={() => void refreshLessons()} />
        </div>
      ) : null}
    </>
  );
}
