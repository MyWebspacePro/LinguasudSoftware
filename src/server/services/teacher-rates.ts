import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import type { TeacherRate } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import * as kinds from "@/server/repositories/course-size-kinds";
import * as peopleRepo from "@/server/repositories/people";
import * as repo from "@/server/repositories/teacher-rates";

export const rateSetSchema = z.object({
  courseSizeKindId: z.uuid(),
  rateChf: z.number().min(0).max(100000),
});

export function getRates(teacherId: string): Promise<TeacherRate[]> {
  return repo.listRates(db(), teacherId);
}

export async function setRate(actor: SessionUser, teacherId: string, input: z.infer<typeof rateSetSchema>): Promise<TeacherRate[]> {
  return db().begin(async (tx) => {
    const teacher = await peopleRepo.getPerson(tx, teacherId);
    if (!teacher) throw notFound("Lehrperson wurde nicht gefunden.");
    const kind = await kinds.getCourseSizeKind(tx, input.courseSizeKindId);
    if (!kind) throw notFound("Kursart wurde nicht gefunden.");
    await repo.upsertRate(tx, { teacherId, courseSizeKindId: input.courseSizeKindId, rateChf: input.rateChf });
    await recordChange(tx, {
      entityType: "teacher_rate",
      entityId: teacherId,
      eventType: "updated",
      summary: `Honorarsatz für «${kind.name}» auf ${input.rateChf.toFixed(2)} CHF gesetzt`,
      actorId: actor.id,
    });
    return repo.listRates(tx, teacherId);
  });
}

export async function removeRate(actor: SessionUser, rateId: string): Promise<void> {
  await db().begin(async (tx) => {
    const removed = await repo.deleteRate(tx, rateId);
    if (!removed) throw notFound("Honorarsatz wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "teacher_rate",
      entityId: rateId,
      eventType: "deleted",
      summary: "Honorarsatz entfernt",
      actorId: actor.id,
    });
  });
}
