import { requireRole } from "@/lib/auth";
import { jsonRoute, notFound, readJson } from "@/server/http";
import * as repo from "@/server/repositories/rooms";
import { db } from "@/server/db";
import { deleteRoom, roomUpdateSchema, updateRoom } from "@/server/services/rooms";

export async function GET(_request: Request, context: { params: Promise<{ roomId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "teacher");
    const { roomId } = await context.params;
    const room = await repo.getRoom(db(), roomId);
    if (!room) throw notFound("Raum wurde nicht gefunden.");
    return { body: { room } };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ roomId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { roomId } = await context.params;
    const patch = roomUpdateSchema.parse(await readJson(request));
    return { body: { room: await updateRoom(actor, roomId, patch) } };
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ roomId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { roomId } = await context.params;
    await deleteRoom(actor, roomId);
    return { body: { deleted: true } };
  });
}
