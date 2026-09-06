export type UserRole = "office" | "teacher" | "participant";

export type Room = {
  id: string;
  name: string;
  capacity: number;
  locationId: string;
};

export type Location = {
  id: string;
  name: string;
  address: string;
  rooms: Room[];
};

export type LessonStatus = "scheduled" | "completed" | "cancelled";

export type DemoLesson = {
  id: string;
  courseCode: string;
  courseName: string;
  language: string;
  level: string;
  participantCount: number;
  teacher: string;
  teacherId: string;
  roomId: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  status: LessonStatus;
  note?: string;
};

export const locations: Location[] = [
  {
    id: "sh1",
    name: "Schaffhausen 1",
    address: "Vorstadt 18, 8200 Schaffhausen",
    rooms: [
      { id: "sh1-a1", name: "A1", capacity: 10, locationId: "sh1" },
      { id: "sh1-a2", name: "A2", capacity: 8, locationId: "sh1" },
      { id: "sh1-b1", name: "B1", capacity: 14, locationId: "sh1" },
    ],
  },
  {
    id: "sh2",
    name: "Schaffhausen 2",
    address: "Mühlentalstrasse 40, 8200 Schaffhausen",
    rooms: [
      { id: "sh2-atelier", name: "Atelier", capacity: 12, locationId: "sh2" },
      { id: "sh2-forum", name: "Forum", capacity: 18, locationId: "sh2" },
    ],
  },
  {
    id: "winterthur",
    name: "Winterthur",
    address: "Stadthausstrasse 61, 8400 Winterthur",
    rooms: [
      { id: "wt-1", name: "Kursraum 1", capacity: 10, locationId: "winterthur" },
      { id: "wt-2", name: "Kursraum 2", capacity: 16, locationId: "winterthur" },
    ],
  },
];

export const rooms = locations.flatMap((location) => location.rooms);

export const demoLessons: DemoLesson[] = [
  { id: "lesson-markel-a2", courseCode: "MARKELDEA201", courseName: "Deutsch A2 · Abendkurs", language: "Deutsch", level: "A2", participantCount: 5, teacher: "Maria Keller", teacherId: "markel", roomId: "sh1-a1", date: "2026-09-07", startMinutes: 18 * 60, durationMinutes: 90, status: "scheduled" },
  { id: "lesson-schmid-b1", courseCode: "SCHMIDDEB101", courseName: "Deutsch B1 · Intensivkurs", language: "Deutsch", level: "B1", participantCount: 8, teacher: "Nina Schmid", teacherId: "schmid", roomId: "sh1-b1", date: "2026-09-07", startMinutes: 9 * 60, durationMinutes: 120, status: "scheduled" },
  { id: "lesson-roth-a1", courseCode: "ROTHFRA101", courseName: "Französisch A1 · Vormittag", language: "Französisch", level: "A1", participantCount: 7, teacher: "Elena Roth", teacherId: "roth", roomId: "sh2-atelier", date: "2026-09-07", startMinutes: 10 * 60 + 30, durationMinutes: 90, status: "scheduled" },
  { id: "lesson-meier-c1", courseCode: "MEIERENC101", courseName: "Englisch C1 · Konversation", language: "Englisch", level: "C1", participantCount: 9, teacher: "Lukas Meier", teacherId: "meier", roomId: "sh2-forum", date: "2026-09-07", startMinutes: 18 * 60 + 15, durationMinutes: 90, status: "scheduled" },
  { id: "lesson-weber-a2", courseCode: "WEBERITA201", courseName: "Italienisch A2 · Abendkurs", language: "Italienisch", level: "A2", participantCount: 6, teacher: "Sofia Weber", teacherId: "weber", roomId: "wt-1", date: "2026-09-07", startMinutes: 18 * 60, durationMinutes: 90, status: "scheduled" },
  { id: "lesson-keller-b2", courseCode: "KELLERDEB201", courseName: "Deutsch B2 · Prüfungsvorbereitung", language: "Deutsch", level: "B2", participantCount: 10, teacher: "Paul Keller", teacherId: "keller", roomId: "wt-2", date: "2026-09-07", startMinutes: 17 * 60 + 30, durationMinutes: 120, status: "scheduled" },
  { id: "lesson-markel-a2-tue", courseCode: "MARKELDEA201", courseName: "Deutsch A2 · Abendkurs", language: "Deutsch", level: "A2", participantCount: 5, teacher: "Maria Keller", teacherId: "markel", roomId: "sh1-a1", date: "2026-09-08", startMinutes: 18 * 60, durationMinutes: 90, status: "scheduled" },
];

export const dayOptions = [
  { value: "2026-09-07", label: "Mo, 7. Sept." },
  { value: "2026-09-08", label: "Di, 8. Sept." },
  { value: "2026-09-09", label: "Mi, 9. Sept." },
];

export function getRoom(roomId: string) {
  return rooms.find((room) => room.id === roomId);
}

export function getLocationForRoom(roomId: string) {
  return locations.find((location) => location.rooms.some((room) => room.id === roomId));
}

export function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const rest = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${rest}`;
}
