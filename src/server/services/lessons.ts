import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { LESSON_STATUSES } from "@/lib/types";
import type { Lesson } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { badRequest, notFound } from "@/server/http";
import * as coursesRepo from "@/server/repositories/courses";
import * as repo from "@/server/repositories/lessons";
import { notify } from "@/server/services/notifications";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.");

export const generateSchema = z
  .object({ courseId: z.uuid().optional(), from: dateString, to: dateString })
  .refine((value) => value.to >= value.from, { message: "Enddatum darf nicht vor Startdatum liegen." });

export const lessonUpdateSchema = z
  .object({
    roomId: z.uuid().nullable().optional(),
    startsAt: z.coerce.date().optional(),
    date: dateString.optional(),
    minutes: z.number().int().min(0).max(1439).optional(),
    durationMinutes: z.number().int().min(15).max(360).optional(),
    status: z.enum(LESSON_STATUSES).optional(),
    isProvisional: z.boolean().optional(),
    cancellationReason: z.string().trim().max(300).nullable().optional(),
    onlineLink: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export function listLessonsByDate(date: string, teacherId?: string): Promise<Lesson[]> {
  return repo.listLessonsByDate(db(), date, teacherId);
}

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let current = start; current <= end; current = new Date(current.getTime() + 24 * 60 * 60 * 1000)) {
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

async function generateForCourse(
  tx: Parameters<typeof coursesRepo.getCourse>[0],
  actor: SessionUser,
  courseId: string,
  from: string,
  to: string,
): Promise<number> {
  const course = await coursesRepo.getCourse(tx, courseId);
  if (!course || course.schedules.length === 0) return 0;

  const breaks = await tx<{ starts_on: string; ends_on: string }[]>`
    SELECT to_char(starts_on, 'YYYY-MM-DD') AS starts_on, to_char(ends_on, 'YYYY-MM-DD') AS ends_on
    FROM course_breaks WHERE course_id = ${courseId}
  `;

  let created = 0;
  for (const date of eachDate(from, to)) {
    if (date < course.startsOn) continue;
    if (course.endsOn && date > course.endsOn) continue;
    if (breaks.some((entry) => date >= entry.starts_on && date <= entry.ends_on)) continue;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const schedule of course.schedules) {
      if (schedule.weekday !== weekday) continue;
      if (await repo.lessonExistsZurich(tx, courseId, date, schedule.startTime)) continue;
      await repo.insertLessonZurich(tx, {
        courseId,
        roomId: course.standardRoomId,
        teacherId: course.teacherId,
        date,
        time: schedule.startTime,
        durationMinutes: schedule.durationMinutes,
        status: "scheduled",
        onlineLink: null,
      });
      created += 1;
    }
  }

  if (created > 0) {
    await recordChange(tx, {
      entityType: "course",
      entityId: courseId,
      eventType: "lessons_generated",
      summary: `${created} Lektionen generiert (${from} – ${to})`,
      actorId: actor.id,
    });
  }
  return created;
}

async function notifyCourseParticipants(
  tx: Parameters<typeof coursesRepo.getCourse>[0],
  courseId: string,
  input: { kind: string; title: string; body?: string | null; entityType: string; entityId: string },
): Promise<void> {
  const rows = await tx<{ participant_id: string }[]>`
    SELECT participant_id FROM enrollments WHERE course_id = ${courseId} AND active = true
  `;
  for (const row of rows) {
    await notify(tx, { userId: row.participant_id, ...input });
  }
}

export async function generateLessons(
  actor: SessionUser,
  input: z.infer<typeof generateSchema>,
): Promise<{ created: number }> {
  return db().begin(async (tx) => {
    if (input.courseId) {
      const course = await coursesRepo.getCourse(tx, input.courseId);
      if (!course) throw notFound("Kurs wurde nicht gefunden.");
      if (course.schedules.length === 0) throw badRequest("Der Kurs hat keinen Wochenplan.");
      return { created: await generateForCourse(tx, actor, input.courseId, input.from, input.to) };
    }

    const courses = await tx<{ id: string }[]>`
      SELECT id FROM courses WHERE status IN ('planned', 'active') AND archived_at IS NULL
    `;
    let created = 0;
    for (const course of courses) {
      created += await generateForCourse(tx, actor, course.id, input.from, input.to);
    }
    return { created };
  });
}

export async function updateLesson(
  actor: SessionUser,
  id: string,
  patch: z.infer<typeof lessonUpdateSchema>,
): Promise<Lesson> {
  return db().begin(async (tx) => {
    const before = await repo.getLesson(tx, id);
    if (!before) throw notFound("Lektion wurde nicht gefunden.");

    const { date, minutes, ...rest } = patch;
    let startsAt = rest.startsAt;
    if (date !== undefined && minutes !== undefined) {
      const [row] = await tx<{ ts: Date }[]>`
        SELECT (${date}::date + (${minutes} * interval '1 minute')) AT TIME ZONE 'Europe/Zurich' AS ts
      `;
      startsAt = row.ts;
    }

    await repo.updateLesson(tx, id, { ...rest, ...(startsAt ? { startsAt } : {}) });
    const lesson = await repo.getLesson(tx, id);
    if (!lesson) throw notFound("Lektion wurde nicht gefunden.");
    const summary =
      patch.isProvisional === false
        ? `Lektion «${lesson.courseCode}» fixiert`
        : patch.isProvisional === true
          ? `Lektion «${lesson.courseCode}» vorläufig verschoben`
          : patch.status === "cancelled"
            ? `Lektion «${lesson.courseCode}» abgesagt`
            : `Lektion «${lesson.courseCode}» geändert`;
    await recordChange(tx, {
      entityType: "lesson",
      entityId: id,
      eventType: "updated",
      summary,
      before,
      after: lesson,
      actorId: actor.id,
    });

    if (patch.status === "cancelled" && before.status !== "cancelled") {
      await notify(tx, {
        userId: lesson.teacherId,
        kind: "lesson_cancelled",
        title: `Lektion ${lesson.courseCode} abgesagt`,
        body: lesson.cancellationReason,
        entityType: "lesson",
        entityId: id,
        emailSubject: `Lektion ${lesson.courseCode} abgesagt`,
      });
      await notifyCourseParticipants(tx, lesson.courseId, {
        kind: "lesson_cancelled",
        title: `Lektion ${lesson.courseCode} abgesagt`,
        body: lesson.cancellationReason,
        entityType: "lesson",
        entityId: id,
      });
    }

    if (patch.isProvisional === false && before.isProvisional && before.roomId !== lesson.roomId) {
      await notify(tx, {
        userId: lesson.teacherId,
        kind: "room_changed",
        title: `Raumwechsel ${lesson.courseCode}`,
        body: `Neuer Raum: ${lesson.roomName ?? "–"}`,
        entityType: "lesson",
        entityId: id,
        emailSubject: `Raumwechsel ${lesson.courseCode}`,
      });
      await notifyCourseParticipants(tx, lesson.courseId, {
        kind: "room_changed",
        title: `Raumwechsel ${lesson.courseCode}`,
        body: `Neuer Raum: ${lesson.roomName ?? "–"}`,
        entityType: "lesson",
        entityId: id,
      });
    }

    return lesson;
  });
}
