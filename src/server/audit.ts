import "server-only";

import { randomUUID } from "node:crypto";

import type { Sql } from "@/server/db";

export type ChangeInput = {
  entityType: string;
  entityId: string;
  eventType: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  actorId: string | null;
};

/** Append an entry to the audit trail within the caller's transaction. */
export async function recordChange(sql: Sql, input: ChangeInput): Promise<void> {
  await sql`
    INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id)
    VALUES (
      ${randomUUID()},
      ${input.entityType},
      ${input.entityId},
      ${input.eventType},
      ${input.summary},
      ${input.before === undefined ? null : JSON.stringify(input.before)}::jsonb,
      ${input.after === undefined ? null : JSON.stringify(input.after)}::jsonb,
      ${input.actorId}
    )
  `;
}
