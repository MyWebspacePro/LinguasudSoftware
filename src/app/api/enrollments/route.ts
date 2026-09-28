import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createEnrollment, enrollmentCreateSchema, listEnrollments } from "@/server/services/enrollments";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const params = new URL(request.url).searchParams;
    const enrollments = await listEnrollments({
      courseId: params.get("courseId") ?? undefined,
      participantId: params.get("participantId") ?? undefined,
      includeInactive: params.get("includeInactive") === "true",
    });
    return { body: { enrollments } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = enrollmentCreateSchema.parse(await readJson(request));
    const enrollment = await createEnrollment(actor, input);
    return { status: 201, body: { enrollment } };
  });
}
