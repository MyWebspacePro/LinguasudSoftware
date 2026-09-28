import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createLocation, listLocations, locationCreateSchema } from "@/server/services/locations";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "teacher");
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    return { body: { locations: await listLocations(includeInactive) } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = locationCreateSchema.parse(await readJson(request));
    const location = await createLocation(actor, input);
    return { status: 201, body: { location } };
  });
}
