import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { listPayroll, materializePayroll, payrollCalcSchema } from "@/server/services/finance";

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const period = new URL(request.url).searchParams.get("period") ?? currentPeriod();
    return { body: { period, payroll: await listPayroll(period) } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { period } = payrollCalcSchema.parse(await readJson(request));
    return { body: { period, payroll: await materializePayroll(actor, period) } };
  });
}
