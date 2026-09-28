import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { assignPlacement, placementAssignmentSchema } from "@/server/services/public-placement";

export async function PATCH(request: Request, context: { params: Promise<{ testId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { testId } = await context.params;
    const input = placementAssignmentSchema.parse(await readJson(request));
    return { body: { result: await assignPlacement(testId, input.participantId, actor.id) } };
  });
}
