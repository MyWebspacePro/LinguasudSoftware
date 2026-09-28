import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import type { CourseSizeKind, Language } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import * as kinds from "@/server/repositories/course-size-kinds";
import * as languages from "@/server/repositories/languages";

/* -------------------------------------------------------------- Sprachen */

export const languageCreateSchema = z.object({
  code: z.string().trim().min(1).max(6).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const languageUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(6).transform((value) => value.toUpperCase()).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export function listLanguages(includeInactive: boolean): Promise<Language[]> {
  return languages.listLanguages(db(), includeInactive);
}

export async function createLanguage(actor: SessionUser, input: z.infer<typeof languageCreateSchema>): Promise<Language> {
  return db().begin(async (tx) => {
    const language = await languages.insertLanguage(tx, input);
    await recordChange(tx, {
      entityType: "language",
      entityId: language.id,
      eventType: "created",
      summary: `Sprache «${language.name}» angelegt`,
      after: language,
      actorId: actor.id,
    });
    return language;
  });
}

export async function updateLanguage(
  actor: SessionUser,
  id: string,
  patch: z.infer<typeof languageUpdateSchema>,
): Promise<Language> {
  return db().begin(async (tx) => {
    const before = await languages.getLanguage(tx, id);
    if (!before) throw notFound("Sprache wurde nicht gefunden.");
    const language = await languages.updateLanguage(tx, id, patch);
    if (!language) throw notFound("Sprache wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "language",
      entityId: id,
      eventType: "updated",
      summary: `Sprache «${language.name}» geändert`,
      before,
      after: language,
      actorId: actor.id,
    });
    return language;
  });
}

/* -------------------------------------------------------------- Kursarten */

const sizeKindFields = {
  code: z.string().trim().min(1).max(6).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(80),
  minParticipants: z.number().int().min(1).max(50),
  maxParticipants: z.number().int().min(1).max(50),
  standardDurationMinutes: z
    .number()
    .int()
    .min(15)
    .max(360)
    .refine((value) => value % 15 === 0, { message: "Dauer muss ein Vielfaches von 15 Minuten sein." })
    .nullish(),
  isOnline: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
};

export const sizeKindCreateSchema = z
  .object(sizeKindFields)
  .refine((value) => value.maxParticipants >= value.minParticipants, {
    message: "Maximale Teilnehmerzahl muss mindestens der minimalen entsprechen.",
  });

export const sizeKindUpdateSchema = z
  .object({
    ...sizeKindFields,
    active: z.boolean().optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export function listCourseSizeKinds(includeInactive: boolean): Promise<CourseSizeKind[]> {
  return kinds.listCourseSizeKinds(db(), includeInactive);
}

export async function createCourseSizeKind(
  actor: SessionUser,
  input: z.infer<typeof sizeKindCreateSchema>,
): Promise<CourseSizeKind> {
  return db().begin(async (tx) => {
    const kind = await kinds.insertCourseSizeKind(tx, { ...input, standardDurationMinutes: input.standardDurationMinutes ?? null });
    await recordChange(tx, {
      entityType: "course_size_kind",
      entityId: kind.id,
      eventType: "created",
      summary: `Kursart «${kind.name}» angelegt`,
      after: kind,
      actorId: actor.id,
    });
    return kind;
  });
}

export async function updateCourseSizeKind(
  actor: SessionUser,
  id: string,
  patch: z.infer<typeof sizeKindUpdateSchema>,
): Promise<CourseSizeKind> {
  return db().begin(async (tx) => {
    const before = await kinds.getCourseSizeKind(tx, id);
    if (!before) throw notFound("Kursart wurde nicht gefunden.");
    const kind = await kinds.updateCourseSizeKind(tx, id, patch);
    if (!kind) throw notFound("Kursart wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "course_size_kind",
      entityId: id,
      eventType: "updated",
      summary: `Kursart «${kind.name}» geändert`,
      before,
      after: kind,
      actorId: actor.id,
    });
    return kind;
  });
}
