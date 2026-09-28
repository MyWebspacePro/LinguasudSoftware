export const COURSE_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_STATUSES = ["planned", "active", "paused", "completed", "cancelled"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const TARIFFS = ["normal", "low"] as const;
export type Tariff = (typeof TARIFFS)[number];

export type Language = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export type CourseSizeKind = {
  id: string;
  code: string;
  name: string;
  minParticipants: number;
  maxParticipants: number;
  standardDurationMinutes: number | null;
  isOnline: boolean;
  active: boolean;
  sortOrder: number;
};

export type CourseSchedule = {
  id: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
};

export type Course = {
  id: string;
  code: string;
  languageId: string;
  languageName: string;
  level: CourseLevel;
  courseSizeKindId: string;
  courseSizeKindName: string;
  teacherId: string;
  teacherName: string;
  standardRoomId: string | null;
  standardRoomName: string | null;
  status: CourseStatus;
  startsOn: string;
  endsOn: string | null;
  schedules: CourseSchedule[];
};

export type PriceList = {
  id: string;
  name: string;
  validFrom: string;
  validTo: string | null;
  active: boolean;
};

export type PriceListItem = {
  id: string;
  priceListId: string;
  courseSizeKindId: string;
  courseSizeKindName: string;
  durationMinutes: number;
  tariff: Tariff;
  minLessons: number;
  packageLessons: number | null;
  priceChf: number;
};
