import { requireRole } from "@/lib/auth";
import { jsonRoute } from "@/server/http";
import { removePriceListItem } from "@/server/services/pricing";

export async function DELETE(_request: Request, context: { params: Promise<{ priceListId: string; itemId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { priceListId, itemId } = await context.params;
    await removePriceListItem(actor, priceListId, itemId);
    return { status: 200, body: { ok: true } };
  });
}
