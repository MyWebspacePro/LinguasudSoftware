import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/lib/database";

export type SecurityEventType =
  | "login_succeeded"
  | "login_failed"
  | "login_blocked"
  | "logout"
  | "password_changed"
  | "account_deactivated"
  | "sessions_revoked";

export type SecurityEventInput = {
  type: SecurityEventType;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

/** Best-effort audit logging; never breaks the calling flow. */
export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    await db()`
      INSERT INTO security_events (id, event_type, user_id, email, ip, user_agent)
      VALUES (${randomUUID()}, ${input.type}, ${input.userId ?? null}, ${input.email ?? null}, ${input.ip ?? null}, ${input.userAgent ?? null})
    `;
  } catch {
    // Audit logging must not fail authentication.
  }
}
