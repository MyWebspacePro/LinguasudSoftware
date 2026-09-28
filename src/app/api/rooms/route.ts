import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createRoom, listRooms, roomCreateSchema } from "@/server/services/rooms";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "teacher");
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    return { body: { rooms: await listRooms(includeInactive) } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = roomCreateSchema.parse(await readJson(request));
    const room = await createRoom(actor, { ...input, floor: input.floor ?? null });
    return { status: 201, body: { room } };
  });
}
