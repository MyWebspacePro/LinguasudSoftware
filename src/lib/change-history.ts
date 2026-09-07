import postgres from "postgres";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type ChangeHistoryInput = {
  entityType: string;
  entityId: string;
  eventType: string;
  summary: string;
  before?: JsonValue;
  after?: JsonValue;
  actorId?: string | null;
};

export async function appendChangeHistory(sql: postgres.Sql, input: ChangeHistoryInput) {
  await sql`
    INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id)
    VALUES (${crypto.randomUUID()}, ${input.entityType}, ${input.entityId}, ${input.eventType}, ${input.summary}, ${input.before ? sql.json(input.before) : null}, ${input.after ? sql.json(input.after) : null}, ${input.actorId ?? null})
  `;
}
