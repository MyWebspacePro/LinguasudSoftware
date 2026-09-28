import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { languageUpdateSchema, updateLanguage } from "@/server/services/course-master";

export async function PATCH(request: Request, context: { params: Promise<{ languageId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { languageId } = await context.params;
    const patch = languageUpdateSchema.parse(await readJson(request));
    return { body: { language: await updateLanguage(actor, languageId, patch) } };
  });
}
