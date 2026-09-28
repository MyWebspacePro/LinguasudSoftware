import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import type { Location } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { conflict, notFound } from "@/server/http";
import * as repo from "@/server/repositories/locations";

export const locationCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: z.string().trim().min(1).max(300),
  sortOrder: z.number().int().min(1).max(999),
});

export const locationUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    address: z.string().trim().min(1).max(300).optional(),
    sortOrder: z.number().int().min(1).max(999).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export function listLocations(includeInactive: boolean): Promise<Location[]> {
  return repo.listLocations(db(), includeInactive);
}

export function getLocation(id: string): Promise<Location | null> {
  return repo.getLocation(db(), id);
}

export async function createLocation(actor: SessionUser, input: repo.LocationInput): Promise<Location> {
  return db().begin(async (tx) => {
    const location = await repo.insertLocation(tx, input);
    await recordChange(tx, {
      entityType: "location",
      entityId: location.id,
      eventType: "created",
      summary: `Standort «${location.name}» angelegt`,
      after: location,
      actorId: actor.id,
    });
    return location;
  });
}

export async function updateLocation(actor: SessionUser, id: string, patch: repo.LocationPatch): Promise<Location> {
  return db().begin(async (tx) => {
    const before = await repo.getLocation(tx, id);
    if (!before) throw notFound("Standort wurde nicht gefunden.");
    const location = await repo.updateLocation(tx, id, patch);
    if (!location) throw notFound("Standort wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "location",
      entityId: id,
      eventType: "updated",
      summary: `Standort «${location.name}» geändert`,
      before,
      after: location,
      actorId: actor.id,
    });
    return location;
  });
}

export async function deleteLocation(actor: SessionUser, id: string): Promise<void> {
  await db().begin(async (tx) => {
    const before = await repo.getLocation(tx, id);
    if (!before) throw notFound("Standort wurde nicht gefunden.");
    const [room] = await tx<{ id: string }[]>`SELECT id FROM rooms WHERE location_id = ${id} LIMIT 1`;
    if (room) throw conflict("Der Standort enthält noch Räume. Diese zuerst löschen oder den Standort deaktivieren.");
    await repo.deleteLocation(tx, id);
    await recordChange(tx, {
      entityType: "location",
      entityId: id,
      eventType: "deleted",
      summary: `Standort «${before.name}» gelöscht`,
      before,
      actorId: actor.id,
    });
  });
}
