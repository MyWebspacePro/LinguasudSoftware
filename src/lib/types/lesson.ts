export const LESSON_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

export type Lesson = {
  id: string;
  courseId: string;
  courseCode: string;
  languageName: string;
  level: string;
  roomId: string | null;
  roomName: string | null;
  locationId: string | null;
  locationName: string | null;
  teacherId: string;
  teacherName: string;
  startsAt: string;
  durationMinutes: number;
  status: LessonStatus;
  isProvisional: boolean;
  cancellationReason: string | null;
  onlineLink: string | null;
  participantCount: number;
};

export const RENTAL_KINDS = ["one_time", "series"] as const;
export type RentalKind = (typeof RENTAL_KINDS)[number];

export type RoomRental = {
  id: string;
  roomId: string;
  roomName: string;
  locationName: string;
  title: string;
  customerName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  kind: RentalKind;
  startsOn: string;
  endsOn: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  startsAt: string | null;
  endsAt: string | null;
  notes: string | null;
};
