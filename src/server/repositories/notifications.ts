import "server-only";

import type { Notification } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: Date | null;
  created_at: Date;
};

const toNotification = (row: Row): Notification => ({
  id: row.id,
  userId: row.user_id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  entityType: row.entity_type,
  entityId: row.entity_id,
  readAt: row.read_at ? row.read_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
});

export async function listForUser(sql: Sql, userId: string, limit = 50): Promise<Notification[]> {
  const rows = await sql<Row[]>`
    SELECT id, user_id, kind, title, body, entity_type, entity_id, read_at, created_at
    FROM notifications
    WHERE user_id = ${userId}
    ORDER BY (read_at IS NOT NULL), created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(toNotification);
}

export async function insertNotification(
  sql: Sql,
  input: { userId: string; kind: string; title: string; body: string | null; entityType: string | null; entityId: string | null },
): Promise<void> {
  await sql`
    INSERT INTO notifications (user_id, kind, title, body, entity_type, entity_id)
    VALUES (${input.userId}, ${input.kind}, ${input.title}, ${input.body}, ${input.entityType}, ${input.entityId})
  `;
}

export async function markRead(sql: Sql, id: string, userId: string): Promise<void> {
  await sql`UPDATE notifications SET read_at = now() WHERE id = ${id} AND user_id = ${userId} AND read_at IS NULL`;
}

export async function markAllRead(sql: Sql, userId: string): Promise<void> {
  await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${userId} AND read_at IS NULL`;
}

export async function listUserIdsByRole(sql: Sql, roles: string[]): Promise<string[]> {
  const rows = await sql<{ user_id: string }[]>`
    SELECT DISTINCT user_id FROM user_roles WHERE role = ANY(${roles}) AND user_id IN (SELECT id FROM users WHERE active = true)
  `;
  return rows.map((row) => row.user_id);
}

export async function enqueueEmail(
  sql: Sql,
  input: { toEmail: string; subject: string; body: string },
): Promise<void> {
  await sql`
    INSERT INTO outbound_messages (to_email, subject, body)
    VALUES (${input.toEmail}, ${input.subject}, ${input.body})
  `;
}

export type QueuedMessage = { id: string; toEmail: string; subject: string; body: string; attempts: number };

export async function listQueuedMessages(sql: Sql, limit = 20): Promise<QueuedMessage[]> {
  const rows = await sql<{ id: string; to_email: string; subject: string; body: string; attempts: number }[]>`
    SELECT id, to_email, subject, body, attempts FROM outbound_messages
    WHERE status = 'queued' AND scheduled_at <= now()
    ORDER BY scheduled_at
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ id: row.id, toEmail: row.to_email, subject: row.subject, body: row.body, attempts: row.attempts }));
}

export async function markMessageSent(sql: Sql, id: string): Promise<void> {
  await sql`UPDATE outbound_messages SET status = 'sent', sent_at = now(), attempts = attempts + 1 WHERE id = ${id}`;
}

export async function markMessageFailed(sql: Sql, id: string, error: string): Promise<void> {
  await sql`UPDATE outbound_messages SET status = 'failed', attempts = attempts + 1, last_error = ${error} WHERE id = ${id}`;
}
