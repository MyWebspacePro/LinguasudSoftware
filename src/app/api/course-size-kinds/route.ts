import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createCourseSizeKind, listCourseSizeKinds, sizeKindCreateSchema } from "@/server/services/course-master";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "teacher");
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    return { body: { courseSizeKinds: await listCourseSizeKinds(includeInactive) } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = sizeKindCreateSchema.parse(await readJson(request));
    return { status: 201, body: { courseSizeKind: await createCourseSizeKind(actor, input) } };
  });
}
