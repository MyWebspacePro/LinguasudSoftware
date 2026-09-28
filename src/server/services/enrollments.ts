import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { BILLING_TYPES, ENROLLMENT_STATUSES } from "@/lib/types";
import type { CreditTransaction, Enrollment } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import * as coursesRepo from "@/server/repositories/courses";
import * as repo from "@/server/repositories/enrollments";
import * as peopleRepo from "@/server/repositories/people";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.");

export const enrollmentCreateSchema = z.object({
  courseId: z.uuid(),
  participantId: z.uuid(),
  status: z.enum(ENROLLMENT_STATUSES).default("active"),
  billingType: z.enum(BILLING_TYPES).default("private"),
  organizationId: z.uuid().nullish(),
  agreedPriceChf: z.number().min(0).max(100000).nullish(),
  agreedLessons: z.number().int().min(1).max(999).nullish(),
  startedOn: dateString.nullish(),
  endedOn: dateString.nullish(),
});

export const enrollmentUpdateSchema = z
  .object({
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    billingType: z.enum(BILLING_TYPES).optional(),
    organizationId: z.uuid().nullish(),
    agreedPriceChf: z.number().min(0).max(100000).nullish(),
    agreedLessons: z.number().int().min(1).max(999).nullish(),
    startedOn: dateString.nullish(),
    endedOn: dateString.nullish(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export const creditCreateSchema = z.object({
  delta: z.number().int().min(-999).max(999).refine((value) => value !== 0, { message: "Delta darf nicht 0 sein." }),
  reason: z.string().trim().min(1).max(200),
});

export function listEnrollments(filter: repo.EnrollmentListFilter): Promise<Enrollment[]> {
  return repo.listEnrollments(db(), filter);
}

export function getEnrollment(id: string): Promise<Enrollment | null> {
  return repo.getEnrollment(db(), id);
}

export function listCredits(enrollmentId: string): Promise<CreditTransaction[]> {
  return repo.listCredits(db(), enrollmentId);
}

export async function createEnrollment(actor: SessionUser, input: z.infer<typeof enrollmentCreateSchema>): Promise<Enrollment> {
  return db().begin(async (tx) => {
    const course = await coursesRepo.getCourse(tx, input.courseId);
    if (!course) throw notFound("Kurs wurde nicht gefunden.");
    const participant = await peopleRepo.getPerson(tx, input.participantId);
    if (!participant) throw notFound("Teilnehmende:r wurde nicht gefunden.");

    const id = await repo.insertEnrollment(tx, {
      courseId: input.courseId,
      participantId: input.participantId,
      status: input.status,
      billingType: input.billingType,
      organizationId: input.organizationId ?? null,
      agreedPriceChf: input.agreedPriceChf ?? null,
      agreedLessons: input.agreedLessons ?? null,
      startedOn: input.startedOn ?? null,
      endedOn: input.endedOn ?? null,
    });

    if (input.agreedLessons) {
      await repo.insertCredit(tx, {
        enrollmentId: id,
        delta: input.agreedLessons,
        reason: `Paket ${input.agreedLessons} Lektionen`,
        actorId: actor.id,
      });
    }

    const enrollment = await repo.getEnrollment(tx, id);
    if (!enrollment) throw notFound("Anmeldung konnte nicht angelegt werden.");
    await recordChange(tx, {
      entityType: "enrollment",
      entityId: id,
      eventType: "created",
      summary: `Anmeldung «${enrollment.participantName}» für «${enrollment.courseCode}» angelegt`,
      after: enrollment,
      actorId: actor.id,
    });
    return enrollment;
  });
}

export async function updateEnrollment(
  actor: SessionUser,
  id: string,
  patch: z.infer<typeof enrollmentUpdateSchema>,
): Promise<Enrollment> {
  return db().begin(async (tx) => {
    const before = await repo.getEnrollment(tx, id);
    if (!before) throw notFound("Anmeldung wurde nicht gefunden.");
    await repo.updateEnrollment(tx, id, patch);
    const enrollment = await repo.getEnrollment(tx, id);
    if (!enrollment) throw notFound("Anmeldung wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "enrollment",
      entityId: id,
      eventType: "updated",
      summary: `Anmeldung «${enrollment.participantName}» für «${enrollment.courseCode}» geändert`,
      before,
      after: enrollment,
      actorId: actor.id,
    });
    return enrollment;
  });
}

export async function addCreditTransaction(
  actor: SessionUser,
  enrollmentId: string,
  input: z.infer<typeof creditCreateSchema>,
): Promise<Enrollment> {
  return db().begin(async (tx) => {
    const before = await repo.getEnrollment(tx, enrollmentId);
    if (!before) throw notFound("Anmeldung wurde nicht gefunden.");
    await repo.insertCredit(tx, { enrollmentId, delta: input.delta, reason: input.reason, actorId: actor.id });
    const enrollment = await repo.getEnrollment(tx, enrollmentId);
    if (!enrollment) throw notFound("Anmeldung wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "enrollment",
      entityId: enrollmentId,
      eventType: "credit_changed",
      summary: `Guthaben ${input.delta > 0 ? "+" : ""}${input.delta}: ${input.reason}`,
      before,
      after: enrollment,
      actorId: actor.id,
    });
    return enrollment;
  });
}
