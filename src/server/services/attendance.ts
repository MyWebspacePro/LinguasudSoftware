import "server-only";

import { z } from "zod";

import { AuthError, type SessionUser } from "@/lib/auth";
import { ATTENDANCE_STATUSES } from "@/lib/types";
import type { LessonAttendanceRow } from "@/lib/types";
import { hasRole } from "@/lib/roles";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { badRequest, notFound } from "@/server/http";
import * as repo from "@/server/repositories/attendance";
import * as enrollmentsRepo from "@/server/repositories/enrollments";
import * as lessonsRepo from "@/server/repositories/lessons";

export const attendanceSaveSchema = z.object({
  entries: z
    .array(z.object({ enrollmentId: z.uuid(), status: z.enum(ATTENDANCE_STATUSES) }))
    .min(1),
});

async function assertLessonAccess(tx: Parameters<typeof lessonsRepo.getLesson>[0], lessonId: string, actor: SessionUser) {
  const lesson = await lessonsRepo.getLesson(tx, lessonId);
  if (!lesson) throw notFound("Lektion wurde nicht gefunden.");
  if (!hasRole(actor, "office", "admin") && lesson.teacherId !== actor.id) throw new AuthError("FORBIDDEN");
  return lesson;
}

export function listAttendance(lessonId: string): Promise<LessonAttendanceRow[]> {
  return repo.listForLesson(db(), lessonId);
}

export async function saveAttendance(
  actor: SessionUser,
  lessonId: string,
  input: z.infer<typeof attendanceSaveSchema>,
): Promise<LessonAttendanceRow[]> {
  return db().begin(async (tx) => {
    await assertLessonAccess(tx, lessonId, actor);
    if (!hasRole(actor, "office", "admin") && input.entries.some((entry) => entry.status === "excused")) {
      throw new AuthError("FORBIDDEN");
    }
    for (const entry of input.entries) {
      await repo.upsert(tx, { lessonId, enrollmentId: entry.enrollmentId, status: entry.status, decidedBy: actor.id });
    }
    await recordChange(tx, {
      entityType: "lesson",
      entityId: lessonId,
      eventType: "attendance_saved",
      summary: `Anwesenheiten erfasst (${input.entries.length})`,
      actorId: actor.id,
    });
    return repo.listForLesson(tx, lessonId);
  });
}

export async function completeLesson(actor: SessionUser, lessonId: string): Promise<{ completed: boolean; consumed: number }> {
  return db().begin(async (tx) => {
    const lesson = await assertLessonAccess(tx, lessonId, actor);
    if (lesson.status === "completed") return { completed: true, consumed: 0 };

    const rows = await repo.listForLesson(tx, lessonId);
    if (rows.length === 0) throw badRequest("Dieser Kurs hat keine aktiven Anmeldungen.");
    if (rows.some((row) => row.status === null)) throw badRequest("Bitte zuerst alle Anwesenheiten erfassen.");

    let consumed = 0;
    for (const row of rows) {
      if (row.status === "present" || row.status === "unexcused") {
        await enrollmentsRepo.insertCredit(tx, {
          enrollmentId: row.enrollmentId,
          delta: -1,
          reason: `Lektion ${lesson.courseCode}`,
          actorId: actor.id,
        });
        consumed += 1;
      }
    }

    await lessonsRepo.updateLesson(tx, lessonId, { status: "completed" });
    await recordChange(tx, {
      entityType: "lesson",
      entityId: lessonId,
      eventType: "completed",
      summary: `Lektion «${lesson.courseCode}» abgeschlossen (${consumed} Lektionen verrechnet)`,
      actorId: actor.id,
    });
    return { completed: true, consumed };
  });
}
