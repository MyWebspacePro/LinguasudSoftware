import { requireRole } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { jsonRoute, readJson } from "@/server/http";
import { courseCreateSchema, createCourse, listCourses } from "@/server/services/courses";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    const user = await requireRole("office", "admin", "teacher");
    const params = new URL(request.url).searchParams;
    const onlyMine = !hasRole(user, "office", "admin");
    const courses = await listCourses({
      includeInactive: params.get("includeInactive") === "true",
      languageId: params.get("languageId") ?? undefined,
      teacherId: onlyMine ? user.id : undefined,
    });
    return { body: { courses } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = courseCreateSchema.parse(await readJson(request));
    const course = await createCourse(actor, input);
    return { status: 201, body: { course } };
  });
}
