"use client";

import { type CSSProperties, type DragEvent, useMemo, useState } from "react";

import {
  dayOptions,
  demoLessons,
  formatTime,
  getLocationForRoom,
  getRoom,
  locations,
  rooms,
  type DemoLesson,
  type UserRole,
} from "@/lib/linguasud-demo";
import { RoleWorkspace } from "@/components/role-workspaces";

const DAY_START = 6 * 60;
const DAY_END = 22 * 60 + 30;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 22;
const BUFFER_MINUTES = 15;

const navigation = [
  ["raumplan", "Raumplan"],
  ["kurse", "Kurse"],
  ["teilnehmende", "Teilnehmende"],
  ["abrechnung", "Abrechnung"],
] as const;

type View = (typeof navigation)[number][0];
type Move = { lessonId: string; roomId: string; startMinutes: number };

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

function roomLabel(roomId: string) {
  const room = getRoom(roomId);
  const location = getLocationForRoom(roomId);
  return room && location ? `${location.name} · ${room.name}` : "Unbekannter Raum";
}

function getLessonStyle(lesson: DemoLesson): CSSProperties {
  return {
    top: `${((lesson.startMinutes - DAY_START) / SLOT_MINUTES) * SLOT_HEIGHT + 2}px`,
    height: `${(lesson.durationMinutes / SLOT_MINUTES) * SLOT_HEIGHT - 4}px`,
  };
}

export function LinguasudDashboard() {
  const [activeView, setActiveView] = useState<View>("raumplan");
  const [activeDay, setActiveDay] = useState(dayOptions[0].value);
  const [activeRole, setActiveRole] = useState<UserRole>("office");
  const [lessons, setLessons] = useState(demoLessons);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [notice, setNotice] = useState("Heute sind 6 Lektionen geplant.");

  const lessonsForDay = useMemo(
    () => lessons.filter((lesson) => lesson.date === activeDay),
    [activeDay, lessons],
  );
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const pageTitle = activeRole === "participant" ? "Mein Kurs" : activeRole === "teacher" ? "Mein Unterricht" : activeView === "raumplan" ? "Raumplan" : navigation.find(([view]) => view === activeView)?.[1];
  const pageEyebrow = activeRole === "participant" ? "Teilnehmerportal" : activeRole === "teacher" ? "Lehrpersonenbereich" : activeView === "raumplan" ? "Tagesplanung" : "Verwaltung";
  const slots = useMemo(
    () => Array.from({ length: (DAY_END - DAY_START) / SLOT_MINUTES }, (_, index) => DAY_START + index * SLOT_MINUTES),
    [],
  );

  function moveLesson(lessonId: string, roomId: string, startMinutes: number) {
    const lesson = lessons.find((item) => item.id === lessonId);
    const targetRoom = getRoom(roomId);
    if (!lesson || !targetRoom) return;

    const endMinutes = startMinutes + lesson.durationMinutes;
    if (startMinutes < DAY_START || endMinutes > DAY_END) {
      setNotice("Die Lektion liegt ausserhalb der konfigurierten Tageszeit.");
      return;
    }
    if (lesson.participantCount > targetRoom.capacity) {
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

    setLastMove({ lessonId, roomId: lesson.roomId, startMinutes: lesson.startMinutes });
    setLessons((current) => current.map((item) => item.id === lessonId ? { ...item, roomId, startMinutes } : item));
    setNotice(`${lesson.courseCode} wurde nach ${roomLabel(roomId)} verschoben.`);
  }

  function onRoomDrop(event: DragEvent<HTMLDivElement>, roomId: string) {
    event.preventDefault();
    const lessonId = event.dataTransfer.getData("text/lesson-id");
    const bounds = event.currentTarget.getBoundingClientRect();
    const rawSlot = Math.floor((event.clientY - bounds.top) / SLOT_HEIGHT);
    const slot = Math.max(0, Math.min(slots.length - 1, rawSlot));
    moveLesson(lessonId, roomId, DAY_START + slot * SLOT_MINUTES);
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
        <a className="brand" href="#raumplan" aria-label="Linguasud Verwaltung">
          <span className="brand__mark">L</span>
          <span>Linguasud<small>Verwaltung</small></span>
        </a>
        <nav aria-label="Hauptnavigation">
          <p className="nav-label">Organisation</p>
          {navigation.map(([view, label]) => (
            <button className={`nav-item ${activeView === view ? "nav-item--active" : ""}`} key={view} onClick={() => setActiveView(view)} type="button">
              <span aria-hidden="true">{view === "raumplan" ? "▦" : view === "kurse" ? "◫" : view === "teilnehmende" ? "◉" : "⊞"}</span>{label}
            </button>
          ))}
          <p className="nav-label nav-label--lower">Arbeitsbereich</p>
          <button className="nav-item" type="button" onClick={() => setNotice("Offene Anwesenheiten werden nach dem Unterricht angezeigt.")}>✓ Anwesenheiten <b>3</b></button>
          <button className="nav-item" type="button" onClick={() => setNotice("Alle Kursunterbrüche werden vom Büro koordiniert.")}>◷ Unterbrüche</button>
        </nav>
        <div className="sidebar__bottom">
          <p>Ansicht simulieren</p>
          <div className="role-switch" aria-label="Rollenansicht">
            {(["office", "teacher", "participant"] as UserRole[]).map((role) => (
              <button className={activeRole === role ? "is-active" : ""} onClick={() => setActiveRole(role)} key={role} type="button">
                {role === "office" ? "Büro" : role === "teacher" ? "Lehrperson" : "Teilnehmer"}
              </button>
            ))}
          </div>
          <div className="profile"><span>AS</span><div><strong>Anna Steiner</strong><small>{activeRole === "office" ? "Büro" : activeRole === "teacher" ? "Lehrperson" : "Teilnehmerin"}</small></div></div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{pageEyebrow}</p><h1>{pageTitle}</h1></div>
          <div className="topbar__actions"><button className="quiet-button" type="button" onClick={() => setNotice("Keine neuen Benachrichtigungen.")}>⌁ <span>Benachrichtigungen</span></button>{activeRole === "office" ? <button className="primary-button" type="button" onClick={() => setNotice("Neue Einträge werden im nächsten Umsetzungsschritt über ein Formular angelegt.")}>+ Neuer Kurs</button> : null}</div>
        </header>

        {activeRole !== "office" ? <RoleWorkspace role={activeRole} onNotice={setNotice} /> : activeView === "raumplan" ? (
          <section className="planner-panel" aria-labelledby="room-plan-title">
            <h2 className="sr-only" id="room-plan-title">Tägliches Raumraster</h2>
            <div className="planner-toolbar">
              <div className="date-controls" aria-label="Tag auswählen">
                {dayOptions.map((day) => <button className={activeDay === day.value ? "date-button is-active" : "date-button"} key={day.value} onClick={() => setActiveDay(day.value)} type="button">{day.label}</button>)}
              </div>
              <div className="planner-toolbar__right"><span className="legend"><i /> Lektion <i className="legend__buffer" /> 15 Min. Puffer</span><button className="quiet-button" type="button" onClick={() => setNotice("Ansicht aktualisiert.")}>↻</button></div>
            </div>
            <div className="planner-notice" role="status"><span>{notice}</span>{lastMove ? <button onClick={undoLastMove} type="button">Rückgängig</button> : null}</div>
            <div className="planner-scroll">
              <div className="planner" style={{ "--room-columns": rooms.length } as CSSProperties}>
                <div className="planner-groups"><div className="planner-corner">Zeit</div>{locations.map((location) => <div className="location-header" key={location.id} style={{ gridColumn: `span ${location.rooms.length}` }}>{location.name}</div>)}</div>
                <div className="planner-room-heads"><div />{rooms.map((room) => <div className="room-head" key={room.id}><strong>{room.name}</strong><span>{room.capacity} Plätze</span></div>)}</div>
                <div className="planner-body">
                  <div className="time-axis" aria-hidden="true">{slots.map((minute) => <div key={minute}>{minute % 60 === 0 ? formatTime(minute) : ""}</div>)}</div>
                  {rooms.map((room) => {
                    const roomLessons = lessonsForDay.filter((lesson) => lesson.roomId === room.id);
                    return <div className="room-column" key={room.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onRoomDrop(event, room.id)}>
                      {slots.map((minute) => <div className="planner-slot" key={minute} />)}
                      {roomLessons.map((lesson) => <button className={`lesson-card lesson-card--${lesson.status}`} draggable key={lesson.id} onClick={() => setSelectedLessonId(lesson.id)} onDragStart={(event) => event.dataTransfer.setData("text/lesson-id", lesson.id)} style={getLessonStyle(lesson)} type="button"><strong>{lesson.courseCode} <span>– {lesson.participantCount}</span></strong><small>{lesson.teacher}</small></button>)}
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : <ManagementPreview view={activeView} onAction={setNotice} />}
      </main>

      {selectedLesson ? <LessonDialog lesson={selectedLesson} onClose={() => setSelectedLessonId(null)} onCancel={() => { setLessons((current) => current.map((lesson) => lesson.id === selectedLesson.id ? { ...lesson, status: "cancelled" } : lesson)); setNotice(`${selectedLesson.courseCode} ist abgesagt. Teilnehmende werden benachrichtigt.`); setSelectedLessonId(null); }} /> : null}
    </div>
  );
}

function ManagementPreview({ view, onAction }: { view: Exclude<View, "raumplan">; onAction: (message: string) => void }) {
  const content = {
    kurse: { title: "Aktive Kurse", count: "24", copy: "Standardzeiten, Räume und Niveauverläufe werden zentral im Büro gepflegt.", cards: ["MARKELDEA201 · Deutsch A2", "SCHMIDDEB101 · Deutsch B1", "ROTHFRA101 · Französisch A1"] },
    teilnehmende: { title: "Teilnehmende", count: "126", copy: "Aktive Teilnahmen, Guthaben und die nächste Lektion auf einen Blick.", cards: ["Lea Baumann · 8 Lektionen verfügbar", "Amir Hussein · Kostenträger: Kanton SH", "Mia Frei · Probelektion am Mittwoch"] },
    abrechnung: { title: "Abrechnung", count: "12", copy: "Bestätigte Lektionen bilden die Grundlage für Guthaben und Sammelrechnungen.", cards: ["4 Guthaben unter 2 Lektionen", "7 Teilnahmen abrechnungsbereit", "1 Rechnung zur Prüfung"] },
  }[view];
  return <section className="management-preview"><div className="preview-intro"><p className="eyebrow">In Vorbereitung</p><h2>{content.title} <span>{content.count}</span></h2><p>{content.copy}</p></div><div className="preview-grid">{content.cards.map((card) => <article key={card}><span>Aktuell</span><h3>{card}</h3><button type="button" onClick={() => onAction(`${card}: Detailansicht wird im nächsten Schritt ergänzt.`)}>Details öffnen →</button></article>)}</div></section>;
}

function LessonDialog({ lesson, onClose, onCancel }: { lesson: DemoLesson; onClose: () => void; onCancel: () => void }) {
  const room = getRoom(lesson.roomId);
  const location = getLocationForRoom(lesson.roomId);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="lesson-dialog" aria-labelledby="lesson-dialog-title" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><button className="dialog-close" onClick={onClose} type="button" aria-label="Details schliessen">×</button><p className="eyebrow">Konkrete Lektion</p><h2 id="lesson-dialog-title">{lesson.courseCode}</h2><p className="dialog-course">{lesson.courseName}</p><dl><div><dt>Termin</dt><dd>{formatTime(lesson.startMinutes)}–{formatTime(lesson.startMinutes + lesson.durationMinutes)} Uhr</dd></div><div><dt>Raum</dt><dd>{location?.name} · {room?.name}</dd></div><div><dt>Lehrperson</dt><dd>{lesson.teacher}</dd></div><div><dt>Teilnehmende</dt><dd>{lesson.participantCount} aktiv</dd></div></dl><div className="dialog-note"><strong>Offene Aufgabe</strong><p>Nach der Lektion Anwesenheiten und Unterrichtsinhalte bestätigen.</p></div><div className="dialog-actions"><button className="danger-button" onClick={onCancel} type="button">Lektion absagen</button><button className="primary-button" onClick={onClose} type="button">Details bearbeiten</button></div></section></div>;
}
