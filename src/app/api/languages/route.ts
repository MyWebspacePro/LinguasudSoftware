import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createLanguage, languageCreateSchema, listLanguages } from "@/server/services/course-master";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "teacher");
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    return { body: { languages: await listLanguages(includeInactive) } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = languageCreateSchema.parse(await readJson(request));
    return { status: 201, body: { language: await createLanguage(actor, input) } };
  });
}
