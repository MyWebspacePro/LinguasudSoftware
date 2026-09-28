export const ABSENCE_STATUSES = ["requested", "approved", "rejected"] as const;
export type AbsenceStatus = (typeof ABSENCE_STATUSES)[number];

export const TEACHER_ABSENCE_ACTIONS = ["pause", "takeover"] as const;
export type TeacherAbsenceAction = (typeof TEACHER_ABSENCE_ACTIONS)[number];

export type TeacherAbsence = {
  id: string;
  teacherId: string;
  teacherName: string;
  courseId: string | null;
  courseCode: string | null;
  startsOn: string;
  endsOn: string;
  action: TeacherAbsenceAction;
  status: AbsenceStatus;
  note: string | null;
  createdAt: string;
};

export type StaffAbsence = {
  id: string;
  userId: string;
  userName: string;
  startsOn: string;
  endsOn: string;
  status: AbsenceStatus;
  kind: string | null;
  note: string | null;
  createdAt: string;
};
