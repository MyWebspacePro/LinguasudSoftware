import { requireRole } from "@/lib/auth";
import { jsonRoute } from "@/server/http";
import { financeOverview } from "@/server/services/finance";

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const period = new URL(request.url).searchParams.get("period") ?? currentPeriod();
    return { body: { overview: await financeOverview(period) } };
  });
}
