export const ATTENDANCE_STATUSES = ["present", "excused", "unexcused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type LessonAttendanceRow = {
  enrollmentId: string;
  participantId: string;
  participantName: string;
  status: AttendanceStatus | null;
  attendanceId: string | null;
};
