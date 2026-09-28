import { requireRole } from "@/lib/auth";
import { db } from "@/server/db";
import { jsonRoute, notFound, readJson } from "@/server/http";
import { listRoomsByLocation } from "@/server/repositories/rooms";
import { getLocation, locationUpdateSchema, updateLocation } from "@/server/services/locations";

export async function GET(_request: Request, context: { params: Promise<{ locationId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "teacher");
    const { locationId } = await context.params;
    const location = await getLocation(locationId);
    if (!location) throw notFound("Standort wurde nicht gefunden.");
    const rooms = await listRoomsByLocation(db(), locationId, true);
    return { body: { location: { ...location, rooms } } };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ locationId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { locationId } = await context.params;
    const patch = locationUpdateSchema.parse(await readJson(request));
    return { body: { location: await updateLocation(actor, locationId, patch) } };
  });
}
