import { requireRole } from "@/lib/auth";
import { jsonRoute, notFound, readJson } from "@/server/http";
import { getTask, taskUpdateSchema, updateTask } from "@/server/services/tasks";

export async function GET(_request: Request, context: { params: Promise<{ taskId: string }> }) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const { taskId } = await context.params;
    const task = await getTask(taskId);
    if (!task) throw notFound("Aufgabe wurde nicht gefunden.");
    return { body: { task } };
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ taskId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { taskId } = await context.params;
    const patch = taskUpdateSchema.parse(await readJson(request));
    return { body: { task: await updateTask(actor, taskId, patch) } };
  });
}
