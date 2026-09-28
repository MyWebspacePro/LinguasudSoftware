import "server-only";

import type { Language } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = { id: string; code: string; name: string; active: boolean; sort_order: number };

const toLanguage = (row: Row): Language => ({
  id: row.id,
  code: row.code,
  name: row.name,
  active: row.active,
  sortOrder: row.sort_order,
});

export async function listLanguages(sql: Sql, includeInactive = false): Promise<Language[]> {
  const rows = await sql<Row[]>`
    SELECT id, code, name, active, sort_order FROM languages
    WHERE active = true OR ${includeInactive}
    ORDER BY sort_order, name
  `;
  return rows.map(toLanguage);
}

export async function getLanguage(sql: Sql, id: string): Promise<Language | null> {
  const [row] = await sql<Row[]>`SELECT id, code, name, active, sort_order FROM languages WHERE id = ${id}`;
  return row ? toLanguage(row) : null;
}

export async function insertLanguage(sql: Sql, input: { code: string; name: string; sortOrder: number }): Promise<Language> {
  const [row] = await sql<Row[]>`
    INSERT INTO languages (code, name, sort_order) VALUES (${input.code}, ${input.name}, ${input.sortOrder})
    RETURNING id, code, name, active, sort_order
  `;
  return toLanguage(row);
}

export async function updateLanguage(
  sql: Sql,
  id: string,
  patch: { code?: string; name?: string; sortOrder?: number; active?: boolean },
): Promise<Language | null> {
  const has = (key: keyof typeof patch) => Object.prototype.hasOwnProperty.call(patch, key);
  const [row] = await sql<Row[]>`
    UPDATE languages SET
      code = CASE WHEN ${has("code")} THEN ${patch.code ?? null} ELSE code END,
      name = CASE WHEN ${has("name")} THEN ${patch.name ?? null} ELSE name END,
      sort_order = CASE WHEN ${has("sortOrder")} THEN ${patch.sortOrder ?? null} ELSE sort_order END,
      active = CASE WHEN ${has("active")} THEN ${patch.active ?? null} ELSE active END
    WHERE id = ${id}
    RETURNING id, code, name, active, sort_order
  `;
  return row ? toLanguage(row) : null;
}
