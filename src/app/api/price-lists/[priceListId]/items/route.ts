import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { addPriceListItem, priceItemCreateSchema } from "@/server/services/pricing";

export async function POST(request: Request, context: { params: Promise<{ priceListId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { priceListId } = await context.params;
    const input = priceItemCreateSchema.parse(await readJson(request));
    return { status: 201, body: { item: await addPriceListItem(actor, priceListId, input) } };
  });
}
