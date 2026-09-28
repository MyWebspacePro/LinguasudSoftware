import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { RENTAL_KINDS } from "@/lib/types";
import type { RoomRental } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { badRequest, notFound } from "@/server/http";
import * as roomsRepo from "@/server/repositories/rooms";
import * as repo from "@/server/repositories/room-rentals";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.");
const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Zeit muss im Format HH:MM sein.");

export const rentalCreateSchema = z
  .object({
    roomId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    customerName: z.string().trim().max(200).nullish(),
    contactEmail: z.email().nullish(),
    contactPhone: z.string().trim().max(60).nullish(),
    kind: z.enum(RENTAL_KINDS),
    startsOn: dateString,
    endsOn: dateString.nullish(),
    weekday: z.number().int().min(0).max(6).nullish(),
    startTime: timeString.nullish(),
    endTime: timeString.nullish(),
    notes: z.string().trim().max(2000).nullish(),
  })
  .refine((value) => value.kind !== "series" || (value.weekday !== null && value.weekday !== undefined && value.startTime && value.endTime), {
    message: "Für Serienvermietungen sind Wochentag und Zeiten erforderlich.",
  });

export function listRentals(): Promise<RoomRental[]> {
  return repo.listRentals(db());
}

export function listRentalsByDate(date: string): Promise<RoomRental[]> {
  return repo.listRentalsByDate(db(), date);
}

export async function createRental(actor: SessionUser, input: z.infer<typeof rentalCreateSchema>): Promise<RoomRental> {
  return db().begin(async (tx) => {
    const room = await roomsRepo.getRoom(tx, input.roomId);
    if (!room) throw notFound("Raum wurde nicht gefunden.");
    const id = await repo.insertRental(tx, {
      roomId: input.roomId,
      title: input.title,
      customerName: input.customerName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      kind: input.kind,
      startsOn: input.startsOn,
      endsOn: input.endsOn ?? null,
      weekday: input.weekday ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      notes: input.notes ?? null,
    });
    const rental = await repo.getRental(tx, id);
    if (!rental) throw badRequest("Vermietung konnte nicht angelegt werden.");
    await recordChange(tx, {
      entityType: "room_rental",
      entityId: id,
      eventType: "created",
      summary: `Raumvermietung «${rental.title}» (${rental.roomName}) angelegt`,
      after: rental,
      actorId: actor.id,
    });
    return rental;
  });
}

export async function deleteRental(actor: SessionUser, id: string): Promise<void> {
  await db().begin(async (tx) => {
    const before = await repo.getRental(tx, id);
    if (!before) throw notFound("Vermietung wurde nicht gefunden.");
    await repo.deleteRental(tx, id);
    await recordChange(tx, {
      entityType: "room_rental",
      entityId: id,
      eventType: "deleted",
      summary: `Raumvermietung «${before.title}» entfernt`,
      before,
      actorId: actor.id,
    });
  });
}
