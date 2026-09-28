import { requireRole } from "@/lib/auth";
import { jsonRoute } from "@/server/http";
import { completeLesson } from "@/server/services/attendance";

export async function POST(_request: Request, context: { params: Promise<{ lessonId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin", "teacher");
    const { lessonId } = await context.params;
    return { body: await completeLesson(actor, lessonId) };
  });
}
