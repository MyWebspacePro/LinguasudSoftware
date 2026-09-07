"use client";

import { type CSSProperties, type DragEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  demoLessons,
  formatTime,
  locations as demoLocations,
  rooms as demoRooms,
  type DemoLesson,
  type Location,
  type Room,
  type UserRole,
} from "@/lib/linguasud-demo";
import { RoleWorkspace } from "@/components/role-workspaces";
import { CourseWorkspace } from "@/components/course-workspace";
import { PeopleWorkspace } from "@/components/people-workspace";
import { BillingWorkspace } from "@/components/billing-workspace";
import { RoomsWorkspace } from "@/components/rooms-workspace";

const DAY_START = 6 * 60;
const DAY_END = 22 * 60 + 30;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 22;
const BUFFER_MINUTES = 15;

const navigation = [
  ["dashboard", "Dashboard"],
  ["teilnehmer", "Teilnehmer"],
  ["lehrpersonen", "Lehrpersonen"],
  ["kurse", "Kurse"],
  ["raeume", "Räume"],
  ["abrechnung", "Abrechnung"],
] as const;

type View = (typeof navigation)[number][0];
type Move = { lessonId: string; roomId: string; startMinutes: number };
type PlannerStatus = "loading" | "ready" | "error";
type PlannerLesson = Omit<DemoLesson, "participantCount"> & { participantCount: number | null };
type PlannerRoom = Room;
type DashboardUser = { name: string; role: UserRole };

type ApiRoom = {
  id: string;
  name: string;
  capacity: number | string;
  location_id: string;
  location_name: string;
};

type ApiLesson = {
  id: string;
  code: string;
  language: string;
  level: string;
  room_id: string;
  teacher_id: string;
  teacher_name: string;
  starts_at: string;
  duration_minutes: number | string;
  participant_count: number | string;
  status: PlannerLesson["status"];
};

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

function roomLabel(roomId: string, rooms: PlannerRoom[], locations: Location[]) {
  const room = rooms.find((item) => item.id === roomId);
  const location = locations.find((item) => item.rooms.some((itemRoom) => itemRoom.id === roomId));
  return room && location ? `${location.name} · ${room.name}` : "Unbekannter Raum";
}

function getLessonStyle(lesson: PlannerLesson): CSSProperties {
  return {
    top: `${((lesson.startMinutes - DAY_START) / SLOT_MINUTES) * SLOT_HEIGHT + 2}px`,
    height: `${(lesson.durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT - 4}px`,
  };
}

function toPlannerRooms(apiRooms: ApiRoom[]): { rooms: PlannerRoom[]; locations: Location[] } {
  const locationsById = new Map<string, Location>();
  const rooms = apiRooms.map((room) => {
    const plannerRoom = { id: room.id, name: room.name, capacity: Number(room.capacity), locationId: room.location_id };
    const existingLocation = locationsById.get(room.location_id);
    if (existingLocation) {
      existingLocation.rooms.push(plannerRoom);
    } else {
      locationsById.set(room.location_id, {
        id: room.location_id,
        name: room.location_name,
        address: "",
        rooms: [plannerRoom],
      });
    }
    return plannerRoom;
  });

  return { rooms, locations: [...locationsById.values()] };
}

function dateAndMinutes(startsAt: string) {
  const date = new Date(startsAt);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    startMinutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function zurichDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDayButton(dateString: string) {
  return new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Zurich" })
    .format(new Date(`${dateString}T12:00:00.000Z`));
}

function toPlannerLessons(apiLessons: ApiLesson[]): PlannerLesson[] {
  return apiLessons.map((lesson) => {
    const { date, startMinutes } = dateAndMinutes(lesson.starts_at);
    return {
      id: lesson.id,
      courseCode: lesson.code,
      courseName: `${lesson.language} ${lesson.level}`,
      language: lesson.language,
      level: lesson.level,
      participantCount: Number(lesson.participant_count),
      teacher: lesson.teacher_name,
      teacherId: lesson.teacher_id,
      roomId: lesson.room_id,
      date,
      startMinutes,
      durationMinutes: Number(lesson.duration_minutes),
      status: lesson.status,
    };
  });
}

export function LinguasudDashboard({ user = { name: "Anna Steiner", role: "office" } }: { user?: DashboardUser }) {
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [activeDay, setActiveDay] = useState(zurichDate);
  const activeRole = user.role;
  const [lessons, setLessons] = useState<PlannerLesson[]>(demoLessons);
  const [plannerRooms, setPlannerRooms] = useState<PlannerRoom[]>(demoRooms);
  const [plannerLocations, setPlannerLocations] = useState<Location[]>(demoLocations);
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatus>("loading");
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [courseOpenRequest, setCourseOpenRequest] = useState(0);
  const [notice, setNotice] = useState("Raumplan wird geladen.");

  const lessonsForDay = useMemo(
    () => lessons.filter((lesson) => lesson.date === activeDay),
    [activeDay, lessons],
  );
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const pageTitle = activeRole === "participant" ? "Mein Kurs" : activeRole === "teacher" ? "Mein Unterricht" : navigation.find(([view]) => view === activeView)?.[1];
  const pageEyebrow = activeRole === "participant" ? "Teilnehmerportal" : activeRole === "teacher" ? "Lehrpersonenbereich" : activeView === "dashboard" ? "Tagesplanung" : "Verwaltung";
  const slots = useMemo(
    () => Array.from({ length: (DAY_END - DAY_START) / SLOT_MINUTES }, (_, index) => DAY_START + index * SLOT_MINUTES),
    [],
  );
  const dateOptions = useMemo(() => [-1, 0, 1, 2, 3].map((offset) => {
    const value = shiftDate(activeDay, offset);
    return { value, label: formatDayButton(value) };
  }), [activeDay]);

  const loadRoomPlan = useCallback(async (signal?: AbortSignal) => {
    setPlannerStatus("loading");
    setPlannerError(null);

    try {
      const [roomsResponse, lessonsResponse] = await Promise.all([
        fetch("/api/rooms", { cache: "no-store", credentials: "same-origin", signal }),
        fetch(`/api/lessons?date=${encodeURIComponent(activeDay)}`, { cache: "no-store", credentials: "same-origin", signal }),
      ]);
      if (!roomsResponse.ok || !lessonsResponse.ok) {
        throw new Error("Der Raumplan konnte nicht geladen werden.");
      }

      const [roomsPayload, lessonsPayload] = await Promise.all([
        roomsResponse.json() as Promise<{ rooms: ApiRoom[] }>,
        lessonsResponse.json() as Promise<{ lessons: ApiLesson[] }>,
      ]);
      if (signal?.aborted) return;

      const roomPlan = toPlannerRooms(roomsPayload.rooms);
      const fetchedLessons = toPlannerLessons(lessonsPayload.lessons);
      setPlannerRooms(roomPlan.rooms);
      setPlannerLocations(roomPlan.locations);
      setLessons(fetchedLessons);
      setNotice(fetchedLessons.length === 0 ? "Für diesen Tag sind keine Lektionen geplant." : `${fetchedLessons.length} Lektion${fetchedLessons.length === 1 ? "" : "en"} geplant.`);
      setPlannerStatus("ready");
    } catch (error) {
      if (signal?.aborted) return;
      const message = error instanceof Error ? error.message : "Der Raumplan konnte nicht geladen werden.";
      setPlannerError(message);
      setPlannerStatus("error");
      setNotice(message);
    }
  }, [activeDay]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadRoomPlan(controller.signal));
    return () => controller.abort();
  }, [loadRoomPlan]);

  async function moveLesson(lessonId: string, roomId: string, startMinutes: number) {
    const lesson = lessons.find((item) => item.id === lessonId);
    const targetRoom = plannerRooms.find((item) => item.id === roomId);
    if (!lesson || !targetRoom) return;

    const endMinutes = startMinutes + lesson.durationMinutes;
    if (startMinutes < DAY_START || endMinutes > DAY_END) {
      setNotice("Die Lektion liegt ausserhalb der konfigurierten Tageszeit.");
      return;
    }
    if (lesson.participantCount !== null && lesson.participantCount > targetRoom.capacity) {
      setNotice(`${targetRoom.name} ist mit ${targetRoom.capacity} Plätzen zu klein für diesen Kurs.`);
      return;
    }

    const otherLessons = lessonsForDay.filter((item) => item.id !== lesson.id && item.status !== "cancelled");
    const roomConflict = otherLessons.some(
      (item) => item.roomId === roomId && overlaps(startMinutes, endMinutes, item.startMinutes, item.startMinutes + item.durationMinutes),
    );
    const teacherConflict = otherLessons.some(
      (item) => item.teacherId === lesson.teacherId && overlaps(startMinutes, endMinutes, item.startMinutes, item.startMinutes + item.durationMinutes),
    );
    if (roomConflict || teacherConflict) {
      setNotice(roomConflict ? "Dieser Raum ist zu dieser Zeit bereits belegt." : "Die Lehrperson ist zu dieser Zeit bereits eingeplant.");
      return;
    }

    const hasBufferWarning = otherLessons.some((item) => {
      if (item.roomId !== roomId) return false;
      const itemEnd = item.startMinutes + item.durationMinutes;
      const gap = startMinutes >= itemEnd ? startMinutes - itemEnd : item.startMinutes - endMinutes;
      return gap >= 0 && gap < BUFFER_MINUTES;
    });
    if (hasBufferWarning && !window.confirm("Der 15-Minuten-Raumpuffer wird unterschritten. Trotzdem verschieben?")) return;

    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ roomId, startsAt: new Date(`${activeDay}T${formatTime(startMinutes)}:00`).toISOString() }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Lektion konnte nicht verschoben werden.");
      setLastMove({ lessonId, roomId: lesson.roomId, startMinutes: lesson.startMinutes });
      setLessons((current) => current.map((item) => item.id === lessonId ? { ...item, roomId, startMinutes } : item));
      setNotice(`${lesson.courseCode} wurde nach ${roomLabel(roomId, plannerRooms, plannerLocations)} verschoben.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Lektion konnte nicht verschoben werden.");
    }
  }

  function onRoomDrop(event: DragEvent<HTMLDivElement>, roomId: string) {
    event.preventDefault();
    const lessonId = event.dataTransfer.getData("text/lesson-id");
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawSlot = Math.floor((event.clientY - bounds.top) / SLOT_HEIGHT);
    const slot = Math.max(0, Math.min(slots.length - 1, rawSlot));
    void moveLesson(lessonId, roomId, DAY_START + slot * SLOT_MINUTES);
  }

  function undoLastMove() {
    if (!lastMove) return;
    const movedLesson = lessons.find((lesson) => lesson.id === lastMove.lessonId);
    if (!movedLesson) return;
    setLessons((current) => current.map((lesson) => lesson.id === lastMove.lessonId ? { ...lesson, roomId: lastMove.roomId, startMinutes: lastMove.startMinutes } : lesson));
    setNotice(`${movedLesson.courseCode} wurde zurückverschoben.`);
    setLastMove(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#dashboard" aria-label="Linguasud Verwaltung">
          <span className="brand__mark">L</span>
          <span>Linguasud<small>Verwaltung</small></span>
        </a>
        {activeRole === "office" ? <nav aria-label="Hauptnavigation">
          <p className="nav-label">Organisation</p>
          {navigation.map(([view, label]) => (
            <button className={`nav-item ${activeView === view ? "nav-item--active" : ""}`} key={view} onClick={() => { setCourseOpenRequest(0); setActiveView(view); }} type="button">
              <span aria-hidden="true">{view === "dashboard" ? "▦" : view === "teilnehmer" ? "◉" : view === "lehrpersonen" ? "♧" : view === "kurse" ? "◫" : view === "raeume" ? "▤" : "⊞"}</span>{label}
            </button>
          ))}
          <p className="nav-label nav-label--lower">Arbeitsbereich</p>
          <button className="nav-item" type="button" onClick={() => setNotice("Offene Anwesenheiten werden nach dem Unterricht angezeigt.")}>✓ Anwesenheiten <b>3</b></button>
          <button className="nav-item" type="button" onClick={() => setNotice("Alle Kursunterbrüche werden vom Büro koordiniert.")}>◷ Unterbrüche</button>
        </nav> : <nav aria-label="Hauptnavigation"><p className="nav-label">Mein Bereich</p><button className="nav-item nav-item--active" type="button">{activeRole === "teacher" ? "◫ Mein Unterricht" : "◉ Mein Kurs"}</button></nav>}
        <div className="sidebar__bottom">
          <div className="profile"><span>{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><strong>{user.name}</strong><small>{activeRole === "office" ? "Büro" : activeRole === "teacher" ? "Lehrperson" : "Teilnehmer:in"}</small></div></div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{pageEyebrow}</p><h1>{pageTitle}</h1></div>
          <div className="topbar__actions"><button className="quiet-button" type="button" onClick={() => setNotice("Keine neuen Benachrichtigungen.")}>⌁ <span>Benachrichtigungen</span></button>{activeRole === "office" ? <button className="primary-button" type="button" onClick={() => { setActiveView("kurse"); setCourseOpenRequest((current) => current + 1); }}>+ Neuer Kurs</button> : null}</div>
        </header>

        {activeRole !== "office" ? <RoleWorkspace role={activeRole} userName={user.name} onNotice={setNotice} /> : activeView === "dashboard" ? (
          <section className="planner-panel" aria-labelledby="room-plan-title">
            <h2 className="sr-only" id="room-plan-title">Tägliches Raumraster</h2>
            <div className="planner-toolbar">
              <div className="date-controls" aria-label="Tag auswählen">
                <button aria-label="Vorheriger Tag" className="quiet-button" onClick={() => setActiveDay((day) => shiftDate(day, -1))} type="button">‹</button>
                {dateOptions.map((day) => <button className={activeDay === day.value ? "date-button is-active" : "date-button"} key={day.value} onClick={() => setActiveDay(day.value)} type="button">{day.label}</button>)}
                <button aria-label="Nächster Tag" className="quiet-button" onClick={() => setActiveDay((day) => shiftDate(day, 1))} type="button">›</button>
                <input aria-label="Datum wählen" onChange={(event) => event.target.value && setActiveDay(event.target.value)} type="date" value={activeDay} />
              </div>
              <div className="planner-toolbar__right"><span className="legend"><i /> Lektion <i className="legend__buffer" /> 15 Min. Puffer</span><button className="quiet-button" type="button" onClick={() => void loadRoomPlan()}>↻</button></div>
            </div>
            <div className="planner-notice" role="status"><span>{notice}</span>{lastMove ? <button onClick={undoLastMove} type="button">Rückgängig</button> : null}</div>
            {plannerStatus === "loading" ? <p className="planner-state" role="status">Aktualisiere Räume und Lektionen …</p> : null}
            {plannerStatus === "error" ? <div className="planner-state" role="alert"><span>{plannerError}</span><button className="quiet-button" onClick={() => void loadRoomPlan()} type="button">Erneut versuchen</button></div> : null}
            {plannerStatus === "ready" && plannerRooms.length === 0 ? <p className="planner-state">Es sind keine aktiven Räume eingerichtet.</p> : null}
            {plannerStatus === "ready" && plannerRooms.length > 0 && lessonsForDay.length === 0 ? <p className="planner-state">Für diesen Tag sind keine Lektionen geplant.</p> : null}
            <div className="planner-scroll">
              <div className="planner" style={{ "--room-columns": plannerRooms.length } as CSSProperties}>
                <div className="planner-groups"><div className="planner-corner">Zeit</div>{plannerLocations.map((location) => <div className="location-header" key={location.id} style={{ gridColumn: `span ${location.rooms.length}` }}>{location.name}</div>)}</div>
                <div className="planner-room-heads"><div />{plannerRooms.map((room) => <div className="room-head" key={room.id}><strong>{room.name}</strong><span>{room.capacity} Plätze</span></div>)}</div>
                <div className="planner-body">
                  <div className="time-axis" aria-hidden="true">{slots.map((minute) => <div key={minute}>{minute % 60 === 0 ? formatTime(minute) : ""}</div>)}</div>
                  {plannerRooms.map((room) => {
                    const roomLessons = lessonsForDay.filter((lesson) => lesson.roomId === room.id);
                    return <div className="room-column" key={room.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onRoomDrop(event, room.id)}>
                      {slots.map((minute) => <div className="planner-slot" key={minute} />)}
                      {roomLessons.map((lesson) => <button className={`lesson-card lesson-card--${lesson.status}`} draggable key={lesson.id} onClick={() => setSelectedLessonId(lesson.id)} onDragStart={(event) => event.dataTransfer.setData("text/lesson-id", lesson.id)} style={getLessonStyle(lesson)} type="button"><strong>{lesson.courseCode}{lesson.participantCount === null ? null : <span> – {lesson.participantCount}</span>}</strong><small>{lesson.teacher}</small></button>)}
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : activeView === "teilnehmer" ? <PeopleWorkspace mode="participants" /> : activeView === "lehrpersonen" ? <PeopleWorkspace mode="teachers" /> : activeView === "kurse" ? <CourseWorkspace initiallyOpen={courseOpenRequest > 0} key={courseOpenRequest} /> : activeView === "raeume" ? <RoomsWorkspace /> : <BillingWorkspace />}
      </main>

      {selectedLesson ? <LessonDialog lesson={selectedLesson} rooms={plannerRooms} locations={plannerLocations} onClose={() => setSelectedLessonId(null)} onCancel={async () => {
        try {
          const response = await fetch(`/api/lessons/${selectedLesson.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ status: "cancelled" }) });
          const payload = await response.json() as { error?: string };
          if (!response.ok) throw new Error(payload.error ?? "Lektion konnte nicht abgesagt werden.");
          setLessons((current) => current.map((lesson) => lesson.id === selectedLesson.id ? { ...lesson, status: "cancelled" } : lesson));
          setNotice(`${selectedLesson.courseCode} ist abgesagt.`);
          setSelectedLessonId(null);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Lektion konnte nicht abgesagt werden.");
        }
      }} /> : null}
    </div>
  );
}

function LessonDialog({ lesson, rooms, locations, onClose, onCancel }: { lesson: PlannerLesson; rooms: PlannerRoom[]; locations: Location[]; onClose: () => void; onCancel: () => void | Promise<void> }) {
  const room = rooms.find((item) => item.id === lesson.roomId);
  const location = locations.find((item) => item.rooms.some((itemRoom) => itemRoom.id === lesson.roomId));
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="lesson-dialog" aria-labelledby="lesson-dialog-title" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><button className="dialog-close" onClick={onClose} type="button" aria-label="Details schliessen">×</button><p className="eyebrow">Konkrete Lektion</p><h2 id="lesson-dialog-title">{lesson.courseCode}</h2><p className="dialog-course">{lesson.courseName}</p><dl><div><dt>Termin</dt><dd>{formatTime(lesson.startMinutes)}–{formatTime(lesson.startMinutes + lesson.durationMinutes)} Uhr</dd></div><div><dt>Raum</dt><dd>{location?.name} · {room?.name}</dd></div><div><dt>Lehrperson</dt><dd>{lesson.teacher}</dd></div><div><dt>Teilnehmende</dt><dd>{lesson.participantCount} aktiv</dd></div></dl><div className="dialog-note"><strong>Offene Aufgabe</strong><p>Nach der Lektion Anwesenheiten und Unterrichtsinhalte bestätigen.</p></div><div className="dialog-actions"><button className="danger-button" onClick={onCancel} type="button">Lektion absagen</button><button className="primary-button" onClick={onClose} type="button">Details bearbeiten</button></div></section></div>;
}
