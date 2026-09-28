import "server-only";

import type { Room } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  location_id: string;
  location_name: string;
  name: string;
  floor: string | null;
  capacity: number;
  active: boolean;
};

const toRoom = (row: Row): Room => ({
  id: row.id,
  locationId: row.location_id,
  locationName: row.location_name,
  name: row.name,
  floor: row.floor,
  capacity: row.capacity,
  active: row.active,
});

export async function listRooms(sql: Sql, includeInactive = false): Promise<Room[]> {
  const rows = await sql<Row[]>`
    SELECT rooms.id, rooms.location_id, locations.name AS location_name, rooms.name, rooms.floor, rooms.capacity, rooms.active
    FROM rooms
    JOIN locations ON locations.id = rooms.location_id
    WHERE (rooms.active = true OR ${includeInactive})
      AND (locations.active = true OR ${includeInactive})
    ORDER BY locations.sort_order, rooms.name
  `;
  return rows.map(toRoom);
}

export async function listRoomsByLocation(sql: Sql, locationId: string, includeInactive = false): Promise<Room[]> {
  const rows = await sql<Row[]>`
    SELECT rooms.id, rooms.location_id, locations.name AS location_name, rooms.name, rooms.floor, rooms.capacity, rooms.active
    FROM rooms
    JOIN locations ON locations.id = rooms.location_id
    WHERE rooms.location_id = ${locationId}
      AND (rooms.active = true OR ${includeInactive})
      AND (locations.active = true OR ${includeInactive})
    ORDER BY rooms.name
  `;
  return rows.map(toRoom);
}

export async function getRoom(sql: Sql, id: string): Promise<Room | null> {
  const [row] = await sql<Row[]>`
    SELECT rooms.id, rooms.location_id, locations.name AS location_name, rooms.name, rooms.floor, rooms.capacity, rooms.active
    FROM rooms
    JOIN locations ON locations.id = rooms.location_id
    WHERE rooms.id = ${id}
  `;
  return row ? toRoom(row) : null;
}

export type RoomInput = {
  locationId: string;
  name: string;
  floor: string | null;
  capacity: number;
};

export async function insertRoom(sql: Sql, input: RoomInput): Promise<Room> {
  const [row] = await sql<Row[]>`
    WITH inserted AS (
      INSERT INTO rooms (location_id, name, floor, capacity)
      VALUES (${input.locationId}, ${input.name}, ${input.floor}, ${input.capacity})
      RETURNING id, location_id, name, floor, capacity, active
    )
    SELECT inserted.id, inserted.location_id, locations.name AS location_name, inserted.name, inserted.floor, inserted.capacity, inserted.active
    FROM inserted JOIN locations ON locations.id = inserted.location_id
  `;
  return toRoom(row);
}

export type RoomPatch = Partial<RoomInput> & { active?: boolean };

export async function updateRoom(sql: Sql, id: string, patch: RoomPatch): Promise<Room | null> {
  const has = (key: keyof RoomPatch) => Object.prototype.hasOwnProperty.call(patch, key);
  const [row] = await sql<Row[]>`
    WITH updated AS (
      UPDATE rooms SET
        location_id = CASE WHEN ${has("locationId")} THEN ${patch.locationId ?? null} ELSE location_id END,
        name = CASE WHEN ${has("name")} THEN ${patch.name ?? null} ELSE name END,
        floor = CASE WHEN ${has("floor")} THEN ${patch.floor ?? null} ELSE floor END,
        capacity = CASE WHEN ${has("capacity")} THEN ${patch.capacity ?? null} ELSE capacity END,
        active = CASE WHEN ${has("active")} THEN ${patch.active ?? null} ELSE active END
      WHERE id = ${id}
      RETURNING id, location_id, name, floor, capacity, active
    )
    SELECT updated.id, updated.location_id, locations.name AS location_name, updated.name, updated.floor, updated.capacity, updated.active
    FROM updated JOIN locations ON locations.id = updated.location_id
  `;
  return row ? toRoom(row) : null;
}

export async function deleteRoom(sql: Sql, id: string): Promise<boolean> {
  const result = await sql`DELETE FROM rooms WHERE id = ${id}`;
  return result.count > 0;
}
