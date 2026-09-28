import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createStaffAbsence, listStaffAbsences, staffAbsenceCreateSchema } from "@/server/services/absences";

export async function GET() {
  return jsonRoute(async () => {
    await requireRole("office", "admin");
    return { body: { absences: await listStaffAbsences() } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = staffAbsenceCreateSchema.parse(await readJson(request));
    return { status: 201, body: { absences: await createStaffAbsence(actor, input) } };
  });
}
