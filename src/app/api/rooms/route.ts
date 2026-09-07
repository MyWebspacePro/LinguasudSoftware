import { NextResponse } from "next/server";

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
