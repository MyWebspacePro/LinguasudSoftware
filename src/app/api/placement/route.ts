import { jsonRoute, readJson } from "@/server/http";
import { listPlacementQuestions, placementSubmissionSchema, submitPlacement } from "@/server/services/public-placement";

export async function GET() {
  return jsonRoute(async () => ({ body: { questions: await listPlacementQuestions() } }));
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const input = placementSubmissionSchema.parse(await readJson(request));
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    return { status: 201, body: await submitPlacement(input, ip) };
  });
}
