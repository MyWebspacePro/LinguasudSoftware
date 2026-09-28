import "server-only";

import type { PriceList, PriceListItem, Tariff } from "@/lib/types";
import type { Sql } from "@/server/db";

type ListRow = { id: string; name: string; valid_from: string; valid_to: string | null; active: boolean };

const toPriceList = (row: ListRow): PriceList => ({
  id: row.id,
  name: row.name,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  active: row.active,
});

type ItemRow = {
  id: string;
  price_list_id: string;
  course_size_kind_id: string;
  course_size_kind_name: string;
  duration_minutes: number;
  tariff: Tariff;
  min_lessons: number;
  package_lessons: number | null;
  price_chf: string;
};

const toItem = (row: ItemRow): PriceListItem => ({
  id: row.id,
  priceListId: row.price_list_id,
  courseSizeKindId: row.course_size_kind_id,
  courseSizeKindName: row.course_size_kind_name,
  durationMinutes: row.duration_minutes,
  tariff: row.tariff,
  minLessons: row.min_lessons,
  packageLessons: row.package_lessons,
  priceChf: Number(row.price_chf),
});

export async function listPriceLists(sql: Sql, includeInactive = false): Promise<PriceList[]> {
  const rows = await sql<ListRow[]>`
    SELECT id, name, valid_from, valid_to, active FROM price_lists
    WHERE active = true OR ${includeInactive}
    ORDER BY valid_from DESC, name
  `;
  return rows.map(toPriceList);
}

export async function getPriceList(sql: Sql, id: string): Promise<PriceList | null> {
  const [row] = await sql<ListRow[]>`SELECT id, name, valid_from, valid_to, active FROM price_lists WHERE id = ${id}`;
  return row ? toPriceList(row) : null;
}

export async function insertPriceList(
  sql: Sql,
  input: { name: string; validFrom: string; validTo: string | null },
): Promise<PriceList> {
  const [row] = await sql<ListRow[]>`
    INSERT INTO price_lists (name, valid_from, valid_to)
    VALUES (${input.name}, ${input.validFrom}, ${input.validTo})
    RETURNING id, name, valid_from, valid_to, active
  `;
  return toPriceList(row);
}

export async function updatePriceList(
  sql: Sql,
  id: string,
  patch: { name?: string; validFrom?: string; validTo?: string | null; active?: boolean },
): Promise<PriceList | null> {
  const has = (key: keyof typeof patch) => Object.prototype.hasOwnProperty.call(patch, key);
  const [row] = await sql<ListRow[]>`
    UPDATE price_lists SET
      name = CASE WHEN ${has("name")} THEN ${patch.name ?? null} ELSE name END,
      valid_from = CASE WHEN ${has("validFrom")} THEN ${patch.validFrom ?? null} ELSE valid_from END,
      valid_to = CASE WHEN ${has("validTo")} THEN ${patch.validTo ?? null} ELSE valid_to END,
      active = CASE WHEN ${has("active")} THEN ${patch.active ?? null} ELSE active END
    WHERE id = ${id}
    RETURNING id, name, valid_from, valid_to, active
  `;
  return row ? toPriceList(row) : null;
}

export async function listPriceListItems(sql: Sql, priceListId: string): Promise<PriceListItem[]> {
  const rows = await sql<ItemRow[]>`
    SELECT items.id, items.price_list_id, items.course_size_kind_id, kinds.name AS course_size_kind_name,
           items.duration_minutes, items.tariff, items.min_lessons, items.package_lessons, items.price_chf
    FROM price_list_items items
    JOIN course_size_kinds kinds ON kinds.id = items.course_size_kind_id
    WHERE items.price_list_id = ${priceListId}
    ORDER BY kinds.sort_order, items.duration_minutes, items.tariff, items.min_lessons
  `;
  return rows.map(toItem);
}

export type PriceItemInput = {
  courseSizeKindId: string;
  durationMinutes: number;
  tariff: Tariff;
  minLessons: number;
  packageLessons: number | null;
  priceChf: number;
};

export async function insertPriceListItem(sql: Sql, priceListId: string, input: PriceItemInput): Promise<PriceListItem> {
  const [row] = await sql<ItemRow[]>`
    WITH inserted AS (
      INSERT INTO price_list_items (price_list_id, course_size_kind_id, duration_minutes, tariff, min_lessons, package_lessons, price_chf)
      VALUES (${priceListId}, ${input.courseSizeKindId}, ${input.durationMinutes}, ${input.tariff}, ${input.minLessons}, ${input.packageLessons}, ${input.priceChf})
      RETURNING id, price_list_id, course_size_kind_id, duration_minutes, tariff, min_lessons, package_lessons, price_chf
    )
    SELECT inserted.id, inserted.price_list_id, inserted.course_size_kind_id, kinds.name AS course_size_kind_name,
           inserted.duration_minutes, inserted.tariff, inserted.min_lessons, inserted.package_lessons, inserted.price_chf
    FROM inserted JOIN course_size_kinds kinds ON kinds.id = inserted.course_size_kind_id
  `;
  return toItem(row);
}

export async function deletePriceListItem(sql: Sql, id: string): Promise<boolean> {
  const result = await sql`DELETE FROM price_list_items WHERE id = ${id}`;
  return result.count > 0;
}

export type ResolvedPrice = { priceChf: number; packageLessons: number | null; priceListName: string };

export async function resolvePrice(
  sql: Sql,
  params: { courseSizeKindId: string; durationMinutes: number; tariff: Tariff; lessonCount: number; onDate: string },
): Promise<ResolvedPrice | null> {
  const [row] = await sql<{ price_chf: string; package_lessons: number | null; name: string }[]>`
    SELECT items.price_chf, items.package_lessons, lists.name
    FROM price_list_items items
    JOIN price_lists lists ON lists.id = items.price_list_id
    WHERE lists.active = true
      AND lists.valid_from <= ${params.onDate}::date
      AND (lists.valid_to IS NULL OR lists.valid_to >= ${params.onDate}::date)
      AND items.course_size_kind_id = ${params.courseSizeKindId}
      AND items.duration_minutes = ${params.durationMinutes}
      AND items.tariff = ${params.tariff}
      AND items.min_lessons <= ${params.lessonCount}
    ORDER BY items.min_lessons DESC, lists.valid_from DESC
    LIMIT 1
  `;
  if (!row) return null;
  return { priceChf: Number(row.price_chf), packageLessons: row.package_lessons, priceListName: row.name };
}
