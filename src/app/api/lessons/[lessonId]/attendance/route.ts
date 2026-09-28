import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { attendanceSaveSchema, listAttendance, saveAttendance } from "@/server/services/attendance";

export async function GET(_request: Request, context: { params: Promise<{ lessonId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "teacher");
    const { lessonId } = await context.params;
    return { body: { attendance: await listAttendance(lessonId) } };
  });
}

export async function PUT(request: Request, context: { params: Promise<{ lessonId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin", "teacher");
    const { lessonId } = await context.params;
    const input = attendanceSaveSchema.parse(await readJson(request));
    return { body: { attendance: await saveAttendance(actor, lessonId, input) } };
  });
}
