import "server-only";

import type { CourseSizeKind } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  code: string;
  name: string;
  min_participants: number;
  max_participants: number;
  standard_duration_minutes: number | null;
  is_online: boolean;
  active: boolean;
  sort_order: number;
};

const toKind = (row: Row): CourseSizeKind => ({
  id: row.id,
  code: row.code,
  name: row.name,
  minParticipants: row.min_participants,
  maxParticipants: row.max_participants,
  standardDurationMinutes: row.standard_duration_minutes,
  isOnline: row.is_online,
  active: row.active,
  sortOrder: row.sort_order,
});

export async function listCourseSizeKinds(sql: Sql, includeInactive = false): Promise<CourseSizeKind[]> {
  const rows = await sql<Row[]>`
    SELECT id, code, name, min_participants, max_participants, standard_duration_minutes, is_online, active, sort_order
    FROM course_size_kinds
    WHERE active = true OR ${includeInactive}
    ORDER BY sort_order, name
  `;
  return rows.map(toKind);
}

export async function getCourseSizeKind(sql: Sql, id: string): Promise<CourseSizeKind | null> {
  const [row] = await sql<Row[]>`
    SELECT id, code, name, min_participants, max_participants, standard_duration_minutes, is_online, active, sort_order
    FROM course_size_kinds WHERE id = ${id}
  `;
  return row ? toKind(row) : null;
}

export type CourseSizeKindInput = {
  code: string;
  name: string;
  minParticipants: number;
  maxParticipants: number;
  standardDurationMinutes: number | null;
  isOnline: boolean;
  sortOrder: number;
};

export async function insertCourseSizeKind(sql: Sql, input: CourseSizeKindInput): Promise<CourseSizeKind> {
  const [row] = await sql<Row[]>`
    INSERT INTO course_size_kinds (code, name, min_participants, max_participants, standard_duration_minutes, is_online, sort_order)
    VALUES (${input.code}, ${input.name}, ${input.minParticipants}, ${input.maxParticipants}, ${input.standardDurationMinutes}, ${input.isOnline}, ${input.sortOrder})
    RETURNING id, code, name, min_participants, max_participants, standard_duration_minutes, is_online, active, sort_order
  `;
  return toKind(row);
}

export async function updateCourseSizeKind(
  sql: Sql,
  id: string,
  patch: Partial<CourseSizeKindInput> & { active?: boolean },
): Promise<CourseSizeKind | null> {
  const has = (key: keyof typeof patch) => Object.prototype.hasOwnProperty.call(patch, key);
  const [row] = await sql<Row[]>`
    UPDATE course_size_kinds SET
      code = CASE WHEN ${has("code")} THEN ${patch.code ?? null} ELSE code END,
      name = CASE WHEN ${has("name")} THEN ${patch.name ?? null} ELSE name END,
      min_participants = CASE WHEN ${has("minParticipants")} THEN ${patch.minParticipants ?? null} ELSE min_participants END,
      max_participants = CASE WHEN ${has("maxParticipants")} THEN ${patch.maxParticipants ?? null} ELSE max_participants END,
      standard_duration_minutes = CASE WHEN ${has("standardDurationMinutes")} THEN ${patch.standardDurationMinutes ?? null} ELSE standard_duration_minutes END,
      is_online = CASE WHEN ${has("isOnline")} THEN ${patch.isOnline ?? null} ELSE is_online END,
      sort_order = CASE WHEN ${has("sortOrder")} THEN ${patch.sortOrder ?? null} ELSE sort_order END,
      active = CASE WHEN ${has("active")} THEN ${patch.active ?? null} ELSE active END
    WHERE id = ${id}
    RETURNING id, code, name, min_participants, max_participants, standard_duration_minutes, is_online, active, sort_order
  `;
  return row ? toKind(row) : null;
}
