import { requireRole } from "@/lib/auth";
import { jsonRoute, notFound, readJson } from "@/server/http";
import { enrollmentUpdateSchema, getEnrollment, updateEnrollment } from "@/server/services/enrollments";

export async function GET(_request: Request, context: { params: Promise<{ enrollmentId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const { enrollmentId } = await context.params;
    const enrollment = await getEnrollment(enrollmentId);
    if (!enrollment) throw notFound("Anmeldung wurde nicht gefunden.");
    return { body: { enrollment } };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ enrollmentId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { enrollmentId } = await context.params;
    const patch = enrollmentUpdateSchema.parse(await readJson(request));
    return { body: { enrollment: await updateEnrollment(actor, enrollmentId, patch) } };
  });
}
