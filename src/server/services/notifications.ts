import "server-only";

import { z } from "zod";

import { db } from "@/server/db";
import type { Sql } from "@/server/db";
import * as repo from "@/server/repositories/notifications";
import { processMailQueue } from "@/server/mailer";
import type { Notification } from "@/lib/types";

export type NotifyInput = {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  emailSubject?: string;
  emailBody?: string;
};

/** Create an in-app notification and optionally enqueue an email. Never throws. */
export async function notify(sql: Sql, input: NotifyInput): Promise<void> {
  try {
    await repo.insertNotification(sql, {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    });
    if (input.emailSubject) {
      const [user] = await sql<{ email: string }[]>`SELECT email FROM users WHERE id = ${input.userId}`;
      if (user?.email) {
        await repo.enqueueEmail(sql, {
          toEmail: user.email,
          subject: input.emailSubject,
          body: input.emailBody ?? input.title,
        });
      }
    }
  } catch {
    // Notifications must never break the business flow.
  }
}

export async function notifyRoles(sql: Sql, roles: string[], input: Omit<NotifyInput, "userId">): Promise<void> {
  try {
    const userIds = await repo.listUserIdsByRole(sql, roles);
    for (const userId of userIds) {
      await notify(sql, { ...input, userId });
    }
  } catch {
    // ignore
  }
}

export function listMyNotifications(userId: string): Promise<Notification[]> {
  return repo.listForUser(db(), userId);
}

export const notificationPatchSchema = z
  .object({ id: z.uuid().optional(), all: z.boolean().optional() })
  .refine((value) => value.id !== undefined || value.all === true, { message: "id oder all erforderlich." });

export async function patchNotifications(userId: string, input: z.infer<typeof notificationPatchSchema>): Promise<void> {
  if (input.all) {
    await repo.markAllRead(db(), userId);
    return;
  }
  if (input.id) await repo.markRead(db(), input.id, userId);
}

export { processMailQueue };
