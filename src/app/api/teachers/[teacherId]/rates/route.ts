import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { getRates, rateSetSchema, setRate } from "@/server/services/teacher-rates";

export async function GET(_request: Request, context: { params: Promise<{ teacherId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const { teacherId } = await context.params;
    return { body: { rates: await getRates(teacherId) } };
  });
}

export async function POST(request: Request, context: { params: Promise<{ teacherId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { teacherId } = await context.params;
    const input = rateSetSchema.parse(await readJson(request));
    return { status: 201, body: { rates: await setRate(actor, teacherId, input) } };
  });
}
