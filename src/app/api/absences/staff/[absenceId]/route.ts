import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { absenceDecisionSchema, decideStaffAbsence } from "@/server/services/absences";

export async function PATCH(request: Request, context: { params: Promise<{ absenceId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { absenceId } = await context.params;
    const input = absenceDecisionSchema.parse(await readJson(request));
    return { body: { absences: await decideStaffAbsence(actor, absenceId, input) } };
  });
}
