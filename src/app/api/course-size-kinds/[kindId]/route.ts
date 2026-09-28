import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { sizeKindUpdateSchema, updateCourseSizeKind } from "@/server/services/course-master";

export async function PATCH(request: Request, context: { params: Promise<{ kindId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { kindId } = await context.params;
    const patch = sizeKindUpdateSchema.parse(await readJson(request));
    return { body: { courseSizeKind: await updateCourseSizeKind(actor, kindId, patch) } };
  });
}
