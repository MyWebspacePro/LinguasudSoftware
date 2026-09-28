import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { getPriceListWithItems, priceListUpdateSchema, updatePriceList } from "@/server/services/pricing";

export async function GET(_request: Request, context: { params: Promise<{ priceListId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const { priceListId } = await context.params;
    return { body: await getPriceListWithItems(priceListId) };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ priceListId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { priceListId } = await context.params;
    const patch = priceListUpdateSchema.parse(await readJson(request));
    return { body: { priceList: await updatePriceList(actor, priceListId, patch) } };
  });
}
