import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { COURSE_LEVELS, COURSE_STATUSES } from "@/lib/types";
import type { Course, CourseSchedule } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import type { Sql } from "@/server/db";
import { badRequest, notFound } from "@/server/http";
import * as coursesRepo from "@/server/repositories/courses";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.");

const scheduleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Zeit muss im Format HH:MM sein."),
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(360)
    .refine((value) => value % 15 === 0, { message: "Dauer muss ein Vielfaches von 15 Minuten sein." }),
});

export const courseCreateSchema = z.object({
  languageId: z.uuid(),
  level: z.enum(COURSE_LEVELS),
  courseSizeKindId: z.uuid(),
  teacherId: z.uuid(),
  standardRoomId: z.uuid().nullish(),
  status: z.enum(COURSE_STATUSES).default("planned"),
  startsOn: dateString,
  endsOn: dateString.nullish(),
  schedules: z.array(scheduleSchema).min(1),
});

export const courseUpdateSchema = z
  .object({
    languageId: z.uuid().optional(),
    level: z.enum(COURSE_LEVELS).optional(),
    courseSizeKindId: z.uuid().optional(),
    teacherId: z.uuid().optional(),
    standardRoomId: z.uuid().nullish(),
    status: z.enum(COURSE_STATUSES).optional(),
    startsOn: dateString.optional(),
    endsOn: dateString.nullish(),
    schedules: z.array(scheduleSchema).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

function slugPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

async function teacherCodeOrFallback(tx: Sql, teacherId: string): Promise<string> {
  const [profile] = await tx<{ code: string }[]>`SELECT code FROM teacher_profiles WHERE user_id = ${teacherId}`;
  if (profile?.code) return profile.code;
  const [user] = await tx<{ first_name: string; last_name: string }[]>`
    SELECT first_name, last_name FROM users WHERE id = ${teacherId}
  `;
  if (!user) throw notFound("Lehrperson wurde nicht gefunden.");
  return `${slugPart(user.first_name)}${slugPart(user.last_name)}` || "LEHR";
}

async function generateCourseCode(
  tx: Sql,
  input: { languageId: string; level: string; courseSizeKindId: string; teacherId: string },
): Promise<string> {
  const [language] = await tx<{ code: string }[]>`SELECT code FROM languages WHERE id = ${input.languageId}`;
  if (!language) throw notFound("Sprache wurde nicht gefunden.");
  const [kind] = await tx<{ code: string }[]>`SELECT code FROM course_size_kinds WHERE id = ${input.courseSizeKindId}`;
  if (!kind) throw notFound("Kursart wurde nicht gefunden.");
  const teacherPart = await teacherCodeOrFallback(tx, input.teacherId);
  const prefix = `${language.code}${input.level}${kind.code}-${teacherPart}-`;

  for (let index = 1; index <= 99; index += 1) {
    const code = `${prefix}${String(index).padStart(2, "0")}`;
    if (!(await coursesRepo.codeExists(tx, code))) return code;
  }
  throw badRequest("Für diese Kombination konnte keine freie Kurskennung erzeugt werden.");
}

function normalizeSchedules(schedules: z.infer<typeof scheduleSchema>[]): CourseSchedule[] {
  return schedules.map((schedule) => ({
    id: "",
    weekday: schedule.weekday,
    startTime: schedule.startTime,
    durationMinutes: schedule.durationMinutes,
  }));
}

export function listCourses(filter: coursesRepo.CourseListFilter): Promise<Course[]> {
  return coursesRepo.listCourses(db(), filter);
}

export function getCourse(id: string): Promise<Course | null> {
  return coursesRepo.getCourse(db(), id);
}

export async function createCourse(actor: SessionUser, input: z.infer<typeof courseCreateSchema>): Promise<Course> {
  return db().begin(async (tx) => {
    const code = await generateCourseCode(tx, input);
    const id = await coursesRepo.insertCourse(tx, {
      code,
      languageId: input.languageId,
      level: input.level,
      courseSizeKindId: input.courseSizeKindId,
      teacherId: input.teacherId,
      standardRoomId: input.standardRoomId ?? null,
      status: input.status,
      startsOn: input.startsOn,
      endsOn: input.endsOn ?? null,
    });
    await coursesRepo.replaceSchedules(tx, id, normalizeSchedules(input.schedules));
    const course = await coursesRepo.getCourse(tx, id);
    if (!course) throw notFound("Kurs konnte nicht angelegt werden.");
    await recordChange(tx, {
      entityType: "course",
      entityId: id,
      eventType: "created",
      summary: `Kurs «${course.code}» angelegt`,
      after: course,
      actorId: actor.id,
    });
    return course;
  });
}

export async function updateCourse(
  actor: SessionUser,
  id: string,
  patch: z.infer<typeof courseUpdateSchema>,
): Promise<Course> {
  const { schedules, ...fields } = patch;
  return db().begin(async (tx) => {
    const before = await coursesRepo.getCourse(tx, id);
    if (!before) throw notFound("Kurs wurde nicht gefunden.");

    const codeAffecting =
      (fields.languageId !== undefined && fields.languageId !== before.languageId) ||
      (fields.level !== undefined && fields.level !== before.level) ||
      (fields.courseSizeKindId !== undefined && fields.courseSizeKindId !== before.courseSizeKindId) ||
      (fields.teacherId !== undefined && fields.teacherId !== before.teacherId);

    let newCode = before.code;
    if (codeAffecting) {
      newCode = await generateCourseCode(tx, {
        languageId: fields.languageId ?? before.languageId,
        level: fields.level ?? before.level,
        courseSizeKindId: fields.courseSizeKindId ?? before.courseSizeKindId,
        teacherId: fields.teacherId ?? before.teacherId,
      });
    }

    await coursesRepo.updateCourse(tx, id, { ...fields, code: newCode });
    if (schedules) await coursesRepo.replaceSchedules(tx, id, normalizeSchedules(schedules));
    if (newCode !== before.code) {
      await coursesRepo.recordCodeChange(tx, id, before.code, newCode, actor.id);
    }

    const course = await coursesRepo.getCourse(tx, id);
    if (!course) throw notFound("Kurs wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "course",
      entityId: id,
      eventType: "updated",
      summary: newCode !== before.code ? `Kurs «${before.code}» → «${newCode}» geändert` : `Kurs «${course.code}» geändert`,
      before,
      after: course,
      actorId: actor.id,
    });
    return course;
  });
}
