import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import type { Room } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import type { Sql } from "@/server/db";
import { notFound } from "@/server/http";
import * as locationsRepo from "@/server/repositories/locations";
import * as repo from "@/server/repositories/rooms";

export const roomCreateSchema = z.object({
  locationId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  floor: z.string().trim().max(60).nullish(),
  capacity: z.number().int().min(1).max(200),
});

export const roomUpdateSchema = z
  .object({
    locationId: z.uuid().optional(),
    name: z.string().trim().min(1).max(80).optional(),
    floor: z.string().trim().max(60).nullish(),
    capacity: z.number().int().min(1).max(200).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export function listRooms(includeInactive: boolean): Promise<Room[]> {
  return repo.listRooms(db(), includeInactive);
}

async function assertLocationExists(tx: Sql, locationId: string) {
  const location = await locationsRepo.getLocation(tx, locationId);
  if (!location) throw notFound("Standort wurde nicht gefunden.");
}

export async function createRoom(actor: SessionUser, input: repo.RoomInput): Promise<Room> {
  return db().begin(async (tx) => {
    await assertLocationExists(tx, input.locationId);
    const room = await repo.insertRoom(tx, input);
    await recordChange(tx, {
      entityType: "room",
      entityId: room.id,
      eventType: "created",
      summary: `Raum «${room.name}» angelegt`,
      after: room,
      actorId: actor.id,
    });
    return room;
  });
}

export async function updateRoom(actor: SessionUser, id: string, patch: repo.RoomPatch): Promise<Room> {
  return db().begin(async (tx) => {
    const before = await repo.getRoom(tx, id);
    if (!before) throw notFound("Raum wurde nicht gefunden.");
    if (patch.locationId) await assertLocationExists(tx, patch.locationId);
    const room = await repo.updateRoom(tx, id, patch);
    if (!room) throw notFound("Raum wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "room",
      entityId: id,
      eventType: "updated",
      summary: `Raum «${room.name}» geändert`,
      before,
      after: room,
      actorId: actor.id,
    });
    return room;
  });
}
