import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

export async function GET() {
  try {
    await requireRole("office", "teacher");
    const rooms = await db()`
      SELECT rooms.id, rooms.name, rooms.capacity, locations.id AS location_id, locations.name AS location_name
      FROM rooms JOIN locations ON locations.id = rooms.location_id
      WHERE rooms.active = true
      ORDER BY locations.sort_order, rooms.name
    `;
    return NextResponse.json({ rooms });
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
}

const createRoomSchema = z.object({
  locationId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    await requireRole("office");
    const input = createRoomSchema.parse(await request.json());
    const [room] = await db()`INSERT INTO rooms (id, location_id, name, capacity) VALUES (${randomUUID()}, ${input.locationId}, ${input.name}, ${input.capacity}) RETURNING id, location_id, name, capacity, active`;
    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Raumdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Dieser Raum existiert bereits an diesem Standort." }, { status: 409 });
    return NextResponse.json({ error: "Raum konnte nicht angelegt werden." }, { status: 500 });
  }
}
