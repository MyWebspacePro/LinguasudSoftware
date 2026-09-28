export const ENROLLMENT_STATUSES = ["interested", "trial", "active", "inactive"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const BILLING_TYPES = ["private", "company", "authority"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export type Enrollment = {
  id: string;
  courseId: string;
  courseCode: string;
  participantId: string;
  participantName: string;
  status: EnrollmentStatus;
  billingType: BillingType;
  organizationId: string | null;
  organizationName: string | null;
  agreedPriceChf: number | null;
  agreedLessons: number | null;
  startedOn: string | null;
  endedOn: string | null;
  active: boolean;
  creditLessons: number;
};

export type CreditTransaction = {
  id: string;
  enrollmentId: string;
  delta: number;
  reason: string;
  createdAt: string;
};
