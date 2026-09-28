import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { inquiryUpdateSchema, updateInquiry } from "@/server/services/public-inquiries";

export async function PATCH(request: Request, context: { params: Promise<{ inquiryId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { inquiryId } = await context.params;
    const input = inquiryUpdateSchema.parse(await readJson(request));
    return { body: { inquiry: await updateInquiry(inquiryId, input, actor.id) } };
  });
}
