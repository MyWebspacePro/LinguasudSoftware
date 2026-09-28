import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { invoiceUpdateSchema, updateInvoice } from "@/server/services/finance";

export async function PATCH(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { invoiceId } = await context.params;
    const patch = invoiceUpdateSchema.parse(await readJson(request));
    return { body: { invoice: await updateInvoice(actor, invoiceId, patch) } };
  });
}
