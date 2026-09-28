import "server-only";

import type { Location } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  name: string;
  address: string;
  sort_order: number;
  active: boolean;
};

const toLocation = (row: Row): Location => ({
  id: row.id,
  name: row.name,
  address: row.address,
  sortOrder: row.sort_order,
  active: row.active,
});

export async function listLocations(sql: Sql, includeInactive = false): Promise<Location[]> {
  const rows = await sql<Row[]>`
    SELECT id, name, address, sort_order, active
    FROM locations
    WHERE active = true OR ${includeInactive}
    ORDER BY sort_order, name
  `;
  return rows.map(toLocation);
}

export async function getLocation(sql: Sql, id: string): Promise<Location | null> {
  const [row] = await sql<Row[]>`
    SELECT id, name, address, sort_order, active FROM locations WHERE id = ${id}
  `;
  return row ? toLocation(row) : null;
}

export type LocationInput = {
  name: string;
  address: string;
  sortOrder: number;
};

export async function insertLocation(sql: Sql, input: LocationInput): Promise<Location> {
  const [row] = await sql<Row[]>`
    INSERT INTO locations (name, address, sort_order)
    VALUES (${input.name}, ${input.address}, ${input.sortOrder})
    RETURNING id, name, address, sort_order, active
  `;
  return toLocation(row);
}

export type LocationPatch = Partial<LocationInput> & { active?: boolean };

export async function updateLocation(sql: Sql, id: string, patch: LocationPatch): Promise<Location | null> {
  const has = (key: keyof LocationPatch) => Object.prototype.hasOwnProperty.call(patch, key);
  const [row] = await sql<Row[]>`
    UPDATE locations SET
      name = CASE WHEN ${has("name")} THEN ${patch.name ?? null} ELSE name END,
      address = CASE WHEN ${has("address")} THEN ${patch.address ?? null} ELSE address END,
      sort_order = CASE WHEN ${has("sortOrder")} THEN ${patch.sortOrder ?? null} ELSE sort_order END,
      active = CASE WHEN ${has("active")} THEN ${patch.active ?? null} ELSE active END
    WHERE id = ${id}
    RETURNING id, name, address, sort_order, active
  `;
  return row ? toLocation(row) : null;
}
