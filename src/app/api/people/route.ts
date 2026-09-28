import { requireRole } from "@/lib/auth";
import { isRole, type Role } from "@/lib/roles";
import { badRequest, jsonRoute, readJson } from "@/server/http";
import { createPerson, listPeople, personCreateSchema } from "@/server/services/people";

function parseRole(value: string | null): Role | undefined {
  return value && isRole(value) ? value : undefined;
}

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const params = new URL(request.url).searchParams;
    const requestedLimit = params.get("limit");
    if (requestedLimit && (params.get("search")?.trim().length ?? 0) < 2) {
      throw badRequest("Für eine begrenzte Suche mindestens zwei Zeichen eingeben.");
    }
    const people = await listPeople({
      role: parseRole(params.get("role")),
      includeInactive: params.get("includeInactive") === "true",
      search: params.get("search") ?? "",
      limit: requestedLimit ? Math.min(50, Math.max(1, Number(requestedLimit) || 20)) : undefined,
    });
    return { body: { people } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = personCreateSchema.parse(await readJson(request));
    const person = await createPerson(actor, input);
    return { status: 201, body: { person } };
  });
}
