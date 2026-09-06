"use client";

import { useState } from "react";

import { formatTime } from "@/lib/linguasud-demo";

type RoleWorkspaceProps = {
  role: "teacher" | "participant";
  onNotice: (message: string) => void;
};

const attendanceDefaults = [
  ["Lea Baumann", "anwesend"],
  ["Amir Hussein", "anwesend"],
  ["Mia Frei", "entschuldigt"],
  ["Noah Keller", "anwesend"],
  ["Sara Vogel", "anwesend"],
] as const;

type AttendanceStatus = "anwesend" | "entschuldigt" | "unentschuldigt" | "online";

export function RoleWorkspace({ role, onNotice }: RoleWorkspaceProps) {
  return role === "teacher" ? <TeacherWorkspace onNotice={onNotice} /> : <ParticipantWorkspace onNotice={onNotice} />;
}

function TeacherWorkspace({ onNotice }: { onNotice: (message: string) => void }) {
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(attendanceDefaults) as Record<string, AttendanceStatus>,
  );

  function saveAttendance() {
    const absent = Object.values(attendance).filter((status) => status !== "anwesend").length;
    onNotice(`Anwesenheit gespeichert. ${absent} Abwesenheit${absent === 1 ? "" : "en"} wird dem Büro angezeigt.`);
    setIsAttendanceOpen(false);
  }

  return <section className="role-workspace" aria-labelledby="teacher-title">
    <div className="role-workspace__intro"><p className="eyebrow">Lehrpersonenbereich</p><h2 id="teacher-title">Guten Abend, Maria.</h2><p>Du siehst nur deine heutigen Lektionen und die dafür nötigen Teilnahmedaten.</p></div>
    <article className="teacher-lesson"><div><span className="status-pill">Heute · 18:00 Uhr</span><h3>Deutsch A2 · Abendkurs</h3><p>Schaffhausen 1 · Raum A1 · 5 Teilnehmende</p></div><button className="primary-button" type="button" onClick={() => setIsAttendanceOpen(true)}>Anwesenheit erfassen</button></article>
    <div className="teacher-grid"><article><span>Danach</span><h3>Unterrichtsinhalt ergänzen</h3><p>Notiere Ablauf, Hausaufgaben und besondere Vorkommnisse direkt bei der Lektion.</p><button type="button" onClick={() => onNotice("Die Lektionsplanung öffnet sich nach Auswahl der konkreten Lektion.")}>Lektionsplanung öffnen →</button></article><article><span>Kursniveau</span><h3>Aktuell A2</h3><p>Niveauänderungen kannst du für deinen Kurs melden. Die sichtbare Kennung passt anschliessend das Büro an.</p><button type="button" onClick={() => onNotice("Niveauänderung als Meldung ans Büro vorbereitet.")}>Niveauänderung melden →</button></article></div>
    {isAttendanceOpen ? <div className="dialog-backdrop" role="presentation"><section className="attendance-dialog" aria-labelledby="attendance-title" role="dialog" aria-modal="true"><button aria-label="Anwesenheit schliessen" className="dialog-close" onClick={() => setIsAttendanceOpen(false)} type="button">×</button><p className="eyebrow">MARKELDEA201 · 18:00–19:30</p><h2 id="attendance-title">Anwesenheit</h2><p className="dialog-course">Bitte nach der stattgefundenen Lektion bestätigen.</p><div className="attendance-list">{attendanceDefaults.map(([name]) => <div key={name}><strong>{name}</strong><select aria-label={`${name} Anwesenheit`} value={attendance[name]} onChange={(event) => setAttendance((current) => ({ ...current, [name]: event.target.value as AttendanceStatus }))}><option value="anwesend">Anwesend</option><option value="entschuldigt">Entschuldigt</option><option value="unentschuldigt">Unentschuldigt</option><option value="online">Online teilgenommen</option></select></div>)}</div><div className="dialog-actions"><button className="quiet-button" onClick={() => setIsAttendanceOpen(false)} type="button">Abbrechen</button><button className="primary-button" onClick={saveAttendance} type="button">Anwesenheit bestätigen</button></div></section></div> : null}
  </section>;
}

function ParticipantWorkspace({ onNotice }: { onNotice: (message: string) => void }) {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const nextLessonTime = 18 * 60;

  return <section className="role-workspace participant-workspace" aria-labelledby="participant-title">
    <div className="role-workspace__intro"><p className="eyebrow">Mein Kurs</p><h2 id="participant-title">Hallo Lea.</h2><p>Hier findest du deine nächsten Termine und wichtige Änderungen.</p></div>
    <article className="next-lesson-card"><div className="next-lesson-card__date"><strong>Mo</strong><span>07</span><small>Sept.</small></div><div><span className="status-pill">Nächste Lektion</span><h3>Deutsch A2 · Abendkurs</h3><p>{formatTime(nextLessonTime)}–19:30 Uhr · Schaffhausen 1 · Raum A1</p><p className="teacher-line">Lehrperson: Maria Keller</p></div></article>
    <div className="participant-grid"><article><span>Benachrichtigungen</span><h3>Erinnerungen</h3><label><input checked={emailEnabled} onChange={(event) => setEmailEnabled(event.target.checked)} type="checkbox" /> E-Mail vor dem Termin</label><label><input checked={pushEnabled} onChange={(event) => setPushEnabled(event.target.checked)} type="checkbox" /> Push bei Raum- oder Zeitänderung</label><button type="button" onClick={() => onNotice("Benachrichtigungseinstellungen gespeichert.")}>Einstellungen speichern →</button></article><article><span>Wichtig</span><h3>Änderungen sofort sichtbar</h3><p>Bei einer Absage oder Raumänderung erscheint die aktuelle Information hier. Zusätzlich wird die gewählte Erinnerung ausgelöst.</p><button type="button" onClick={() => onNotice("Aktuell gibt es keine Änderungen an deinem Kurs.")}>Aktuellen Status prüfen →</button></article></div>
  </section>;
}
