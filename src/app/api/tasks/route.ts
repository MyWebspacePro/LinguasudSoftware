import { requireRole } from "@/lib/auth";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";
import { jsonRoute, readJson } from "@/server/http";
import { createTask, listTasks, taskCreateSchema } from "@/server/services/tasks";

function parseStatus(value: string | null): TaskStatus | undefined {
  return value && (TASK_STATUSES as readonly string[]).includes(value) ? (value as TaskStatus) : undefined;
}

export async function GET(request: Request) {
  return jsonRoute(async () => {
    const user = await requireRole("office", "admin", "finance");
    const params = new URL(request.url).searchParams;
    const tasks = await listTasks({
      status: parseStatus(params.get("status")),
      assignedTo: params.get("mine") === "true" ? user.id : (params.get("assignedTo") ?? undefined),
    });
    return { body: { tasks } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = taskCreateSchema.parse(await readJson(request));
    return { status: 201, body: { task: await createTask(actor, input) } };
  });
}
