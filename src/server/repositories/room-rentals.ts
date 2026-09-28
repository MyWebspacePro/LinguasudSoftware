import "server-only";

import type { RentalKind, RoomRental } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  room_id: string;
  room_name: string;
  location_name: string;
  title: string;
  customer_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  kind: RentalKind;
  starts_on: string;
  ends_on: string | null;
  weekday: number | null;
  start_time: string | null;
  end_time: string | null;
  starts_at: Date | null;
  ends_at: Date | null;
  notes: string | null;
};

const toRental = (row: Row): RoomRental => ({
  id: row.id,
  roomId: row.room_id,
  roomName: row.room_name,
  locationName: row.location_name,
  title: row.title,
  customerName: row.customer_name,
  contactEmail: row.contact_email,
  contactPhone: row.contact_phone,
  kind: row.kind,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  weekday: row.weekday,
  startTime: row.start_time,
  endTime: row.end_time,
  startsAt: row.starts_at ? row.starts_at.toISOString() : null,
  endsAt: row.ends_at ? row.ends_at.toISOString() : null,
  notes: row.notes,
});

export async function listRentals(sql: Sql): Promise<RoomRental[]> {
  const rows = await sql<Row[]>`
    SELECT rentals.id, rentals.room_id, rooms.name AS room_name, locations.name AS location_name,
           rentals.title, rentals.customer_name, rentals.contact_email, rentals.contact_phone, rentals.kind,
           to_char(rentals.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(rentals.ends_on, 'YYYY-MM-DD') AS ends_on,
           rentals.weekday, to_char(rentals.start_time, 'HH24:MI') AS start_time, to_char(rentals.end_time, 'HH24:MI') AS end_time,
           rentals.starts_at, rentals.ends_at, rentals.notes
    FROM room_rentals rentals
    JOIN rooms ON rooms.id = rentals.room_id
    JOIN locations ON locations.id = rooms.location_id
    ORDER BY rentals.starts_on DESC, rooms.name
  `;
  return rows.map(toRental);
}

export async function listRentalsByDate(sql: Sql, date: string): Promise<RoomRental[]> {
  const rows = await sql<Row[]>`
    SELECT rentals.id, rentals.room_id, rooms.name AS room_name, locations.name AS location_name,
           rentals.title, rentals.customer_name, rentals.contact_email, rentals.contact_phone, rentals.kind,
           to_char(rentals.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(rentals.ends_on, 'YYYY-MM-DD') AS ends_on,
           rentals.weekday, to_char(rentals.start_time, 'HH24:MI') AS start_time, to_char(rentals.end_time, 'HH24:MI') AS end_time,
           rentals.starts_at, rentals.ends_at, rentals.notes
    FROM room_rentals rentals
    JOIN rooms ON rooms.id = rentals.room_id
    JOIN locations ON locations.id = rooms.location_id
    WHERE (rentals.kind = 'one_time' AND (rentals.starts_at AT TIME ZONE 'Europe/Zurich')::date = ${date}::date)
       OR (rentals.kind = 'series' AND ${date}::date BETWEEN rentals.starts_on AND COALESCE(rentals.ends_on, rentals.starts_on) AND rentals.weekday = EXTRACT(DOW FROM ${date}::date))
    ORDER BY rooms.name
  `;
  return rows.map(toRental);
}

export async function listRentalsByDateRange(sql: Sql, from: string, to: string): Promise<RoomRental[]> {
  const rows = await sql<Row[]>`
    SELECT rentals.id, rentals.room_id, rooms.name AS room_name, locations.name AS location_name,
           rentals.title, rentals.customer_name, rentals.contact_email, rentals.contact_phone, rentals.kind,
           to_char(rentals.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(rentals.ends_on, 'YYYY-MM-DD') AS ends_on,
           rentals.weekday, to_char(rentals.start_time, 'HH24:MI') AS start_time, to_char(rentals.end_time, 'HH24:MI') AS end_time,
           rentals.starts_at, rentals.ends_at, rentals.notes
    FROM room_rentals rentals
    JOIN rooms ON rooms.id = rentals.room_id
    JOIN locations ON locations.id = rooms.location_id
    WHERE (rentals.kind = 'one_time' AND (rentals.starts_at AT TIME ZONE 'Europe/Zurich')::date BETWEEN ${from}::date AND ${to}::date)
       OR (rentals.kind = 'series' AND rentals.starts_on <= ${to}::date AND COALESCE(rentals.ends_on, ${to}::date) >= ${from}::date)
    ORDER BY rooms.name, rentals.start_time
  `;
  return rows.map(toRental);
}

export async function getRental(sql: Sql, id: string): Promise<RoomRental | null> {
  const [row] = await sql<Row[]>`
    SELECT rentals.id, rentals.room_id, rooms.name AS room_name, locations.name AS location_name,
           rentals.title, rentals.customer_name, rentals.contact_email, rentals.contact_phone, rentals.kind,
           to_char(rentals.starts_on, 'YYYY-MM-DD') AS starts_on, to_char(rentals.ends_on, 'YYYY-MM-DD') AS ends_on,
           rentals.weekday, to_char(rentals.start_time, 'HH24:MI') AS start_time, to_char(rentals.end_time, 'HH24:MI') AS end_time,
           rentals.starts_at, rentals.ends_at, rentals.notes
    FROM room_rentals rentals
    JOIN rooms ON rooms.id = rentals.room_id
    JOIN locations ON locations.id = rooms.location_id
    WHERE rentals.id = ${id}
  `;
  return row ? toRental(row) : null;
}

export type RentalInput = {
  roomId: string;
  title: string;
  customerName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  kind: RentalKind;
  startsOn: string;
  endsOn: string | null;
  weekday: number | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
};

export async function insertRental(sql: Sql, input: RentalInput): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO room_rentals (room_id, title, customer_name, contact_email, contact_phone, kind, starts_on, ends_on, weekday, start_time, end_time, starts_at, ends_at, notes)
    VALUES (
      ${input.roomId}, ${input.title}, ${input.customerName}, ${input.contactEmail}, ${input.contactPhone},
      ${input.kind}, ${input.startsOn}, ${input.endsOn}, ${input.weekday}, ${input.startTime}, ${input.endTime},
      CASE WHEN ${input.kind} = 'one_time' THEN (${input.startsOn}::date + COALESCE(${input.startTime}::time, '08:00'::time)) AT TIME ZONE 'Europe/Zurich' ELSE NULL END,
      CASE WHEN ${input.kind} = 'one_time' THEN (COALESCE(${input.endsOn}, ${input.startsOn})::date + COALESCE(${input.endTime}::time, '20:00'::time)) AT TIME ZONE 'Europe/Zurich' ELSE NULL END,
      ${input.notes}
    )
    RETURNING id
  `;
  return row.id;
}

export async function deleteRental(sql: Sql, id: string): Promise<boolean> {
  const result = await sql`DELETE FROM room_rentals WHERE id = ${id}`;
  return result.count > 0;
}
