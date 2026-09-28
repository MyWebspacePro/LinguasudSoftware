import { requireRole } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { jsonRoute, readJson } from "@/server/http";
import { generateLessons, generateSchema, listLessonsByDate } from "@/server/services/lessons";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    const user = await requireRole("office", "admin", "teacher");
    const date = new URL(request.url).searchParams.get("date");
    if (!date) return { status: 400, body: { error: "Datum fehlt." } };
    const teacherId = hasRole(user, "office", "admin") ? undefined : user.id;
    return { body: { lessons: await listLessonsByDate(date, teacherId) } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = generateSchema.parse(await readJson(request));
    return { status: 201, body: await generateLessons(actor, input) };
  });
}
