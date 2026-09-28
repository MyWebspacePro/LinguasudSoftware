import "server-only";

import type { TeacherRate } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  teacher_id: string;
  course_size_kind_id: string;
  course_size_kind_name: string;
  rate_chf: string;
};

const toRate = (row: Row): TeacherRate => ({
  id: row.id,
  teacherId: row.teacher_id,
  courseSizeKindId: row.course_size_kind_id,
  courseSizeKindName: row.course_size_kind_name,
  rateChf: Number(row.rate_chf),
});

export async function listRates(sql: Sql, teacherId: string): Promise<TeacherRate[]> {
  const rows = await sql<Row[]>`
    SELECT rates.id, rates.teacher_id, rates.course_size_kind_id, kinds.name AS course_size_kind_name, rates.rate_chf
    FROM teacher_rates rates
    JOIN course_size_kinds kinds ON kinds.id = rates.course_size_kind_id
    WHERE rates.teacher_id = ${teacherId}
    ORDER BY kinds.sort_order
  `;
  return rows.map(toRate);
}

export async function upsertRate(
  sql: Sql,
  input: { teacherId: string; courseSizeKindId: string; rateChf: number },
): Promise<TeacherRate> {
  const [row] = await sql<Row[]>`
    WITH upserted AS (
      INSERT INTO teacher_rates (teacher_id, course_size_kind_id, rate_chf)
      VALUES (${input.teacherId}, ${input.courseSizeKindId}, ${input.rateChf})
      ON CONFLICT (teacher_id, course_size_kind_id) DO UPDATE SET rate_chf = EXCLUDED.rate_chf
      RETURNING id, teacher_id, course_size_kind_id, rate_chf
    )
    SELECT upserted.id, upserted.teacher_id, upserted.course_size_kind_id, kinds.name AS course_size_kind_name, upserted.rate_chf
    FROM upserted JOIN course_size_kinds kinds ON kinds.id = upserted.course_size_kind_id
  `;
  return toRate(row);
}

export async function deleteRate(sql: Sql, id: string): Promise<boolean> {
  const result = await sql`DELETE FROM teacher_rates WHERE id = ${id}`;
  return result.count > 0;
}
