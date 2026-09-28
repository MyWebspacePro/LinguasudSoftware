import { requireRole } from "@/lib/auth";
import { ORGANIZATION_KINDS, type OrganizationKind } from "@/lib/types";
import { jsonRoute, readJson } from "@/server/http";
import {
  createOrganization,
  listOrganizations,
  organizationCreateSchema,
} from "@/server/services/organizations";

function parseKind(value: string | null): OrganizationKind | undefined {
  return value && (ORGANIZATION_KINDS as readonly string[]).includes(value) ? (value as OrganizationKind) : undefined;
}

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const params = new URL(request.url).searchParams;
    const organizations = await listOrganizations({
      kind: parseKind(params.get("kind")),
      includeInactive: params.get("includeInactive") === "true",
    });
    return { body: { organizations } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = organizationCreateSchema.parse(await readJson(request));
    const organization = await createOrganization(actor, input);
    return { status: 201, body: { organization } };
  });
}
