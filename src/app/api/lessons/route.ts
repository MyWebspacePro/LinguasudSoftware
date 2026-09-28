import { requireRole } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { jsonRoute, readJson } from "@/server/http";
import { generateLessons, generateSchema, listLessonsByDate, listLessonsByDateRange } from "@/server/services/lessons";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    const user = await requireRole("office", "admin", "teacher");
    const params = new URL(request.url).searchParams;
    const from = params.get("from");
    const to = params.get("to");
    if (from || to) {
      const range = generateSchema.safeParse({ from, to });
      if (!range.success) return { status: 400, body: { error: "Ungültiger Datumsbereich." } };
      const teacherId = hasRole(user, "office", "admin") ? undefined : user.id;
      return { body: { lessons: await listLessonsByDateRange(from!, to!, teacherId) } };
    }
    const date = params.get("date");
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
