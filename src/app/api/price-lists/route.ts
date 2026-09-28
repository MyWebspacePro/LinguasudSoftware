import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createPriceList, listPriceLists, priceListCreateSchema } from "@/server/services/pricing";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    return { body: { priceLists: await listPriceLists(includeInactive) } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = priceListCreateSchema.parse(await readJson(request));
    return { status: 201, body: { priceList: await createPriceList(actor, input) } };
  });
}
