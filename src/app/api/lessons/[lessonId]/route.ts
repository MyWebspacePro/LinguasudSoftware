import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { lessonUpdateSchema, updateLesson } from "@/server/services/lessons";

export async function PATCH(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { lessonId } = await context.params;
    const patch = lessonUpdateSchema.parse(await readJson(request));
    return { body: { lesson: await updateLesson(actor, lessonId, patch) } };
  });
}
