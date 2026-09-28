import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { listMyNotifications, notificationPatchSchema, patchNotifications } from "@/server/services/notifications";

export async function GET() {
  return jsonRoute(async () => {
    const user = await requireRole("office", "admin", "finance", "teacher", "participant");
    return { body: { notifications: await listMyNotifications(user.id) } };
  });
}

export async function PATCH(request: Request) {
  return jsonRoute(async () => {
    const user = await requireRole("office", "admin", "finance", "teacher", "participant");
    const input = notificationPatchSchema.parse(await readJson(request));
    await patchNotifications(user.id, input);
    return { body: { notifications: await listMyNotifications(user.id) } };
  });
}
