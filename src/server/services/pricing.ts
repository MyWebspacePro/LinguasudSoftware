import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { TARIFFS } from "@/lib/types";
import type { PriceList, PriceListItem } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import * as kinds from "@/server/repositories/course-size-kinds";
import * as repo from "@/server/repositories/pricing";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.");

export const priceListCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    validFrom: dateString,
    validTo: dateString.nullish(),
  })
  .refine((value) => !value.validTo || value.validTo >= value.validFrom, {
    message: "Gültig-bis darf nicht vor Gültig-ab liegen.",
  });

export const priceListUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    validFrom: dateString.optional(),
    validTo: dateString.nullish(),
    active: z.boolean().optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export const priceItemCreateSchema = z.object({
  courseSizeKindId: z.uuid(),
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(360)
    .refine((value) => value % 15 === 0, { message: "Dauer muss ein Vielfaches von 15 Minuten sein." }),
  tariff: z.enum(TARIFFS),
  minLessons: z.number().int().min(1).max(999).default(1),
  packageLessons: z.number().int().min(1).max(999).nullish(),
  priceChf: z.number().min(0).max(100000),
});

export function listPriceLists(includeInactive: boolean): Promise<PriceList[]> {
  return repo.listPriceLists(db(), includeInactive);
}

export async function getPriceListWithItems(id: string): Promise<{ priceList: PriceList; items: PriceListItem[] }> {
  const priceList = await repo.getPriceList(db(), id);
  if (!priceList) throw notFound("Preisliste wurde nicht gefunden.");
  const items = await repo.listPriceListItems(db(), id);
  return { priceList, items };
}

export async function createPriceList(actor: SessionUser, input: z.infer<typeof priceListCreateSchema>): Promise<PriceList> {
  return db().begin(async (tx) => {
    const priceList = await repo.insertPriceList(tx, {
      name: input.name,
      validFrom: input.validFrom,
      validTo: input.validTo ?? null,
    });
    await recordChange(tx, {
      entityType: "price_list",
      entityId: priceList.id,
      eventType: "created",
      summary: `Preisliste «${priceList.name}» angelegt`,
      after: priceList,
      actorId: actor.id,
    });
    return priceList;
  });
}

export async function updatePriceList(
  actor: SessionUser,
  id: string,
  patch: z.infer<typeof priceListUpdateSchema>,
): Promise<PriceList> {
  return db().begin(async (tx) => {
    const before = await repo.getPriceList(tx, id);
    if (!before) throw notFound("Preisliste wurde nicht gefunden.");
    const priceList = await repo.updatePriceList(tx, id, patch);
    if (!priceList) throw notFound("Preisliste wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "price_list",
      entityId: id,
      eventType: "updated",
      summary: `Preisliste «${priceList.name}» geändert`,
      before,
      after: priceList,
      actorId: actor.id,
    });
    return priceList;
  });
}

export async function addPriceListItem(
  actor: SessionUser,
  priceListId: string,
  input: z.infer<typeof priceItemCreateSchema>,
): Promise<PriceListItem> {
  return db().begin(async (tx) => {
    const priceList = await repo.getPriceList(tx, priceListId);
    if (!priceList) throw notFound("Preisliste wurde nicht gefunden.");
    const kind = await kinds.getCourseSizeKind(tx, input.courseSizeKindId);
    if (!kind) throw notFound("Kursart wurde nicht gefunden.");
    const item = await repo.insertPriceListItem(tx, priceListId, {
      courseSizeKindId: input.courseSizeKindId,
      durationMinutes: input.durationMinutes,
      tariff: input.tariff,
      minLessons: input.minLessons,
      packageLessons: input.packageLessons ?? null,
      priceChf: input.priceChf,
    });
    await recordChange(tx, {
      entityType: "price_list_item",
      entityId: item.id,
      eventType: "created",
      summary: `Preisposition ${kind.name} ${item.durationMinutes} Min. (${item.tariff}) angelegt`,
      after: item,
      actorId: actor.id,
    });
    return item;
  });
}

export async function removePriceListItem(actor: SessionUser, priceListId: string, itemId: string): Promise<void> {
  await db().begin(async (tx) => {
    const items = await repo.listPriceListItems(tx, priceListId);
    const item = items.find((entry) => entry.id === itemId);
    if (!item) throw notFound("Preisposition wurde nicht gefunden.");
    await repo.deletePriceListItem(tx, itemId);
    await recordChange(tx, {
      entityType: "price_list_item",
      entityId: itemId,
      eventType: "deleted",
      summary: `Preisposition entfernt`,
      before: item,
      actorId: actor.id,
    });
  });
}
