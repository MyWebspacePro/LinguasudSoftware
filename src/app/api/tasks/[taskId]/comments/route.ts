import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { addComment, listComments, taskCommentSchema } from "@/server/services/tasks";

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const { taskId } = await context.params;
    return { body: { comments: await listComments(taskId) } };
  });
}

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { taskId } = await context.params;
    const input = taskCommentSchema.parse(await readJson(request));
    return { status: 201, body: { comments: await addComment(actor, taskId, input) } };
  });
}
