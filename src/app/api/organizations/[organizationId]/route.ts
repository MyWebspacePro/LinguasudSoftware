import { requireRole } from "@/lib/auth";
import { jsonRoute, notFound, readJson } from "@/server/http";
import {
  getOrganization,
  organizationUpdateSchema,
  updateOrganization,
} from "@/server/services/organizations";

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const { organizationId } = await context.params;
    const organization = await getOrganization(organizationId);
    if (!organization) throw notFound("Kostenträger wurde nicht gefunden.");
    return { body: { organization } };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { organizationId } = await context.params;
    const patch = organizationUpdateSchema.parse(await readJson(request));
    return { body: { organization: await updateOrganization(actor, organizationId, patch) } };
  });
}
