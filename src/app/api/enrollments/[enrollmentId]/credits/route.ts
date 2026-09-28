import { requireRole } from "@/lib/auth";
import { jsonRoute, notFound, readJson } from "@/server/http";
import {
  addCreditTransaction,
  creditCreateSchema,
  getEnrollment,
  listCredits,
} from "@/server/services/enrollments";

export async function GET(_request: Request, context: { params: Promise<{ enrollmentId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const { enrollmentId } = await context.params;
    const enrollment = await getEnrollment(enrollmentId);
    if (!enrollment) throw notFound("Anmeldung wurde nicht gefunden.");
    return { body: { credits: await listCredits(enrollmentId) } };
  });
}

export async function POST(request: Request, context: { params: Promise<{ enrollmentId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { enrollmentId } = await context.params;
    const input = creditCreateSchema.parse(await readJson(request));
    const enrollment = await addCreditTransaction(actor, enrollmentId, input);
    return { status: 201, body: { enrollment } };
  });
}
