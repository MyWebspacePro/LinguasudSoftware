import "server-only";

import { z } from "zod";

import { AuthError, type SessionUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { TEACHER_ABSENCE_ACTIONS } from "@/lib/types";
import type { AbsenceStatus, StaffAbsence, TeacherAbsence } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import * as repo from "@/server/repositories/absences";
import { notify, notifyRoles } from "@/server/services/notifications";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.");
const rangeRefine = (value: { startsOn: string; endsOn: string }) => value.endsOn >= value.startsOn;

export const teacherAbsenceCreateSchema = z
  .object({
    teacherId: z.uuid().optional(),
    courseId: z.uuid().nullish(),
    startsOn: dateString,
    endsOn: dateString,
    action: z.enum(TEACHER_ABSENCE_ACTIONS).default("pause"),
    note: z.string().trim().max(1000).nullish(),
  })
  .refine(rangeRefine, { message: "Enddatum darf nicht vor Startdatum liegen." });

export const absenceDecisionSchema = z.object({ status: z.enum(["approved", "rejected"]) });

export function listTeacherAbsences(actor: SessionUser, filter: { status?: AbsenceStatus }): Promise<TeacherAbsence[]> {
  const isOffice = hasRole(actor, "office", "admin");
  return repo.listTeacherAbsences(db(), { status: filter.status, teacherId: isOffice ? undefined : actor.id });
}

export async function createTeacherAbsence(
  actor: SessionUser,
  input: z.infer<typeof teacherAbsenceCreateSchema>,
): Promise<TeacherAbsence> {
  const isOffice = hasRole(actor, "office", "admin");
  const teacherId = isOffice && input.teacherId ? input.teacherId : actor.id;
  if (!isOffice && !hasRole(actor, "teacher")) throw new AuthError("FORBIDDEN");

  return db().begin(async (tx) => {
    const id = await repo.insertTeacherAbsence(tx, {
      teacherId,
      courseId: input.courseId ?? null,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      action: input.action,
      note: input.note ?? null,
    });
    await notifyRoles(tx, ["office", "admin"], {
      kind: "teacher_absence",
      title: "Neue Abwesenheitsmeldung einer Lehrperson",
      body: `${input.startsOn} – ${input.endsOn} (${input.action === "pause" ? "Kurs pausiert" : "Übernahme nötig"})`,
      entityType: "teacher_absence",
      entityId: id,
    });
    await recordChange(tx, {
      entityType: "teacher_absence",
      entityId: id,
      eventType: "requested",
      summary: `Abwesenheit ${input.startsOn}–${input.endsOn} gemeldet`,
      actorId: actor.id,
    });
    const absence = await repo.getTeacherAbsence(tx, id);
    if (!absence) throw notFound("Abwesenheit konnte nicht angelegt werden.");
    return absence;
  });
}

export async function decideTeacherAbsence(
  actor: SessionUser,
  id: string,
  input: z.infer<typeof absenceDecisionSchema>,
): Promise<TeacherAbsence> {
  return db().begin(async (tx) => {
    const before = await repo.getTeacherAbsence(tx, id);
    if (!before) throw notFound("Abwesenheit wurde nicht gefunden.");
    await repo.setTeacherAbsenceStatus(tx, id, input.status, actor.id);
    await notify(tx, {
      userId: before.teacherId,
      kind: "teacher_absence_decision",
      title: input.status === "approved" ? "Abwesenheit bestätigt" : "Abwesenheit abgelehnt",
      body: `${before.startsOn} – ${before.endsOn}`,
      entityType: "teacher_absence",
      entityId: id,
      emailSubject: input.status === "approved" ? "Ihre Abwesenheit wurde bestätigt" : "Ihre Abwesenheit wurde abgelehnt",
    });
    await recordChange(tx, {
      entityType: "teacher_absence",
      entityId: id,
      eventType: input.status,
      summary: `Abwesenheit ${input.status === "approved" ? "bestätigt" : "abgelehnt"}`,
      before,
      actorId: actor.id,
    });
    const absence = await repo.getTeacherAbsence(tx, id);
    if (!absence) throw notFound("Abwesenheit wurde nicht gefunden.");
    return absence;
  });
}

export const staffAbsenceCreateSchema = z
  .object({
    userId: z.uuid().optional(),
    startsOn: dateString,
    endsOn: dateString,
    kind: z.string().trim().max(80).nullish(),
    note: z.string().trim().max(1000).nullish(),
  })
  .refine(rangeRefine, { message: "Enddatum darf nicht vor Startdatum liegen." });

export function listStaffAbsences(): Promise<StaffAbsence[]> {
  return repo.listStaffAbsences(db());
}

export async function createStaffAbsence(
  actor: SessionUser,
  input: z.infer<typeof staffAbsenceCreateSchema>,
): Promise<StaffAbsence[]> {
  await db().begin(async (tx) => {
    await repo.insertStaffAbsence(tx, {
      userId: input.userId ?? actor.id,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      kind: input.kind ?? null,
      note: input.note ?? null,
    });
    await recordChange(tx, {
      entityType: "staff_absence",
      entityId: input.userId ?? actor.id,
      eventType: "created",
      summary: `Büro-Abwesenheit ${input.startsOn}–${input.endsOn} erfasst`,
      actorId: actor.id,
    });
  });
  return repo.listStaffAbsences(db());
}

export async function decideStaffAbsence(
  actor: SessionUser,
  id: string,
  input: z.infer<typeof absenceDecisionSchema>,
): Promise<StaffAbsence[]> {
  await repo.setStaffAbsenceStatus(db(), id, input.status, actor.id);
  return repo.listStaffAbsences(db());
}
