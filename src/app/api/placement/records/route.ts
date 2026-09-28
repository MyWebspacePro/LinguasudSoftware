import { requireRole } from "@/lib/auth";
import { jsonRoute } from "@/server/http";
import { listPlacementResults } from "@/server/services/public-placement";

export async function GET() {
  return jsonRoute(async () => {
    await requireRole("office", "admin");
    return { body: { results: await listPlacementResults() } };
  });
}
