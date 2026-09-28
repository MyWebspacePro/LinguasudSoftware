import { requireRole } from "@/lib/auth";
import { jsonRoute } from "@/server/http";
import { markPayrollPaid } from "@/server/services/finance";

export async function PATCH(_request: Request, context: { params: Promise<{ payrollId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { payrollId } = await context.params;
    return { body: { payroll: await markPayrollPaid(actor, payrollId) } };
  });
}
