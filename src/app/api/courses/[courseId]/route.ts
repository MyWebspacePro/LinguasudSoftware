import { AuthError, requireRole } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { jsonRoute, notFound, readJson } from "@/server/http";
import { courseUpdateSchema, getCourse, updateCourse } from "@/server/services/courses";

export async function GET(_request: Request, context: { params: Promise<{ courseId: string }> }) {
  return jsonRoute(async () => {
    const user = await requireRole("office", "admin", "teacher");
    const { courseId } = await context.params;
    const course = await getCourse(courseId);
    if (!course) throw notFound("Kurs wurde nicht gefunden.");
    if (!hasRole(user, "office", "admin") && course.teacherId !== user.id) throw new AuthError("FORBIDDEN");
    return { body: { course } };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { courseId } = await context.params;
    const patch = courseUpdateSchema.parse(await readJson(request));
    return { body: { course: await updateCourse(actor, courseId, patch) } };
  });
}
