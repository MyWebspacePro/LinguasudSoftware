import { requireRole } from "@/lib/auth";
import { ABSENCE_STATUSES, type AbsenceStatus } from "@/lib/types";
import { jsonRoute, readJson } from "@/server/http";
import { createTeacherAbsence, listTeacherAbsences, teacherAbsenceCreateSchema } from "@/server/services/absences";

function parseStatus(value: string | null): AbsenceStatus | undefined {
  return value && (ABSENCE_STATUSES as readonly string[]).includes(value) ? (value as AbsenceStatus) : undefined;
}

export async function GET(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin", "teacher");
    const status = parseStatus(new URL(request.url).searchParams.get("status"));
    return { body: { absences: await listTeacherAbsences(actor, { status }) } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin", "teacher");
    const input = teacherAbsenceCreateSchema.parse(await readJson(request));
    return { status: 201, body: { absence: await createTeacherAbsence(actor, input) } };
  });
}
