import { requireRole } from "@/lib/auth";
import { jsonRoute } from "@/server/http";
import { removeRate } from "@/server/services/teacher-rates";

export async function DELETE(_request: Request, context: { params: Promise<{ teacherId: string; rateId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { rateId } = await context.params;
    await removeRate(actor, rateId);
    return { status: 200, body: { ok: true } };
  });
}
