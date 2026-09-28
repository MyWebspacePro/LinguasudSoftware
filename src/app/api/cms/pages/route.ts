import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { listEditablePages, publicPageSchema, savePublicPage } from "@/server/services/public-pages";

export async function GET() {
  return jsonRoute(async () => {
    await requireRole("office", "admin");
    return { body: { pages: await listEditablePages() } };
  });
}

export async function PUT(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = publicPageSchema.parse(await readJson(request));
    return { body: { page: await savePublicPage(input, actor.id) } };
  });
}
