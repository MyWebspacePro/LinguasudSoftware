import { requireRole } from "@/lib/auth";
import { jsonRoute } from "@/server/http";
import { processMailQueue } from "@/server/services/notifications";

export async function POST() {
  return jsonRoute(async () => {
    await requireRole("admin");
    return { body: await processMailQueue(50) };
  });
}
