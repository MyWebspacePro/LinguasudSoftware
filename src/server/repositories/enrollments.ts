import "server-only";

import type { BillingType, CreditTransaction, Enrollment, EnrollmentStatus } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  course_id: string;
  course_code: string;
  participant_id: string;
  participant_name: string;
  status: EnrollmentStatus;
  billing_type: BillingType;
  organization_id: string | null;
  organization_name: string | null;
  agreed_price_chf: string | null;
  agreed_lessons: number | null;
  started_on: string | null;
  ended_on: string | null;
  active: boolean;
  credit_lessons: number;
};

const toEnrollment = (row: Row): Enrollment => ({
  id: row.id,
  courseId: row.course_id,
  courseCode: row.course_code,
  participantId: row.participant_id,
  participantName: row.participant_name,
  status: row.status,
  billingType: row.billing_type,
  organizationId: row.organization_id,
  organizationName: row.organization_name,
  agreedPriceChf: row.agreed_price_chf === null ? null : Number(row.agreed_price_chf),
  agreedLessons: row.agreed_lessons,
  startedOn: row.started_on,
  endedOn: row.ended_on,
  active: row.active,
  creditLessons: row.credit_lessons,
});

export type EnrollmentListFilter = {
  courseId?: string;
  participantId?: string;
  includeInactive?: boolean;
};

export async function listEnrollments(sql: Sql, filter: EnrollmentListFilter = {}): Promise<Enrollment[]> {
  const includeInactive = filter.includeInactive === true;
  const rows = await sql<Row[]>`
    SELECT enrollments.id, enrollments.course_id, courses.code AS course_code,
           enrollments.participant_id, participant.first_name || ' ' || participant.last_name AS participant_name,
           enrollments.status, enrollments.billing_type, enrollments.organization_id, organizations.name AS organization_name,
           enrollments.agreed_price_chf, enrollments.agreed_lessons,
           to_char(enrollments.started_on, 'YYYY-MM-DD') AS started_on,
           to_char(enrollments.ended_on, 'YYYY-MM-DD') AS ended_on,
           enrollments.active,
           COALESCE((SELECT sum(delta)::int FROM credit_transactions ct WHERE ct.enrollment_id = enrollments.id), 0) AS credit_lessons
    FROM enrollments
    JOIN courses ON courses.id = enrollments.course_id
    JOIN users participant ON participant.id = enrollments.participant_id
    LEFT JOIN organizations ON organizations.id = enrollments.organization_id
    WHERE (enrollments.active = true OR ${includeInactive})
      AND (${filter.courseId ?? null}::uuid IS NULL OR enrollments.course_id = ${filter.courseId ?? null})
      AND (${filter.participantId ?? null}::uuid IS NULL OR enrollments.participant_id = ${filter.participantId ?? null})
    ORDER BY courses.code, participant.last_name, participant.first_name
  `;
  return rows.map(toEnrollment);
}

export async function getEnrollment(sql: Sql, id: string): Promise<Enrollment | null> {
  const [row] = await sql<Row[]>`
    SELECT enrollments.id, enrollments.course_id, courses.code AS course_code,
           enrollments.participant_id, participant.first_name || ' ' || participant.last_name AS participant_name,
           enrollments.status, enrollments.billing_type, enrollments.organization_id, organizations.name AS organization_name,
           enrollments.agreed_price_chf, enrollments.agreed_lessons,
           to_char(enrollments.started_on, 'YYYY-MM-DD') AS started_on,
           to_char(enrollments.ended_on, 'YYYY-MM-DD') AS ended_on,
           enrollments.active,
           COALESCE((SELECT sum(delta)::int FROM credit_transactions ct WHERE ct.enrollment_id = enrollments.id), 0) AS credit_lessons
    FROM enrollments
    JOIN courses ON courses.id = enrollments.course_id
    JOIN users participant ON participant.id = enrollments.participant_id
    LEFT JOIN organizations ON organizations.id = enrollments.organization_id
    WHERE enrollments.id = ${id}
  `;
  return row ? toEnrollment(row) : null;
}

export type EnrollmentInput = {
  courseId: string;
  participantId: string;
  status: EnrollmentStatus;
  billingType: BillingType;
  organizationId: string | null;
  agreedPriceChf: number | null;
  agreedLessons: number | null;
  startedOn: string | null;
  endedOn: string | null;
};

export async function insertEnrollment(sql: Sql, input: EnrollmentInput): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO enrollments (course_id, participant_id, status, billing_type, organization_id, agreed_price_chf, agreed_lessons, started_on, ended_on)
    VALUES (${input.courseId}, ${input.participantId}, ${input.status}, ${input.billingType}, ${input.organizationId}, ${input.agreedPriceChf}, ${input.agreedLessons}, ${input.startedOn}, ${input.endedOn})
    RETURNING id
  `;
  return row.id;
}

export type EnrollmentPatch = Partial<Omit<EnrollmentInput, "courseId" | "participantId">> & { active?: boolean };

export async function updateEnrollment(sql: Sql, id: string, patch: EnrollmentPatch): Promise<void> {
  const has = (key: keyof EnrollmentPatch) => Object.prototype.hasOwnProperty.call(patch, key);
  await sql`
    UPDATE enrollments SET
      status = CASE WHEN ${has("status")} THEN ${patch.status ?? null} ELSE status END,
      billing_type = CASE WHEN ${has("billingType")} THEN ${patch.billingType ?? null} ELSE billing_type END,
      organization_id = CASE WHEN ${has("organizationId")} THEN ${patch.organizationId ?? null} ELSE organization_id END,
      agreed_price_chf = CASE WHEN ${has("agreedPriceChf")} THEN ${patch.agreedPriceChf ?? null} ELSE agreed_price_chf END,
      agreed_lessons = CASE WHEN ${has("agreedLessons")} THEN ${patch.agreedLessons ?? null} ELSE agreed_lessons END,
      started_on = CASE WHEN ${has("startedOn")} THEN ${patch.startedOn ?? null} ELSE started_on END,
      ended_on = CASE WHEN ${has("endedOn")} THEN ${patch.endedOn ?? null} ELSE ended_on END,
      active = CASE WHEN ${has("active")} THEN ${patch.active ?? null} ELSE active END
    WHERE id = ${id}
  `;
}

export async function insertCredit(
  sql: Sql,
  input: { enrollmentId: string; delta: number; reason: string; actorId: string | null },
): Promise<void> {
  await sql`
    INSERT INTO credit_transactions (enrollment_id, delta, reason, created_by)
    VALUES (${input.enrollmentId}, ${input.delta}, ${input.reason}, ${input.actorId})
  `;
}

export async function listCredits(sql: Sql, enrollmentId: string): Promise<CreditTransaction[]> {
  const rows = await sql<{ id: string; enrollment_id: string; delta: number; reason: string; created_at: string }[]>`
    SELECT id, enrollment_id, delta, reason, created_at FROM credit_transactions
    WHERE enrollment_id = ${enrollmentId}
    ORDER BY created_at DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    enrollmentId: row.enrollment_id,
    delta: row.delta,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
