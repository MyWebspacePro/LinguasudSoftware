import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { inquirySchema, listInquiries, submitInquiry } from "@/server/services/public-inquiries";

export async function GET() {
  return jsonRoute(async () => {
    await requireRole("office", "admin");
    return { body: { inquiries: await listInquiries() } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const input = inquirySchema.parse(await readJson(request));
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    return { status: 201, body: await submitInquiry(input, ip) };
  });
}
