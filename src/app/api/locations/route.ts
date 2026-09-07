import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const createLocationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(4).max(300),
  sortOrder: z.number().int().min(1).max(99),
});

export async function GET() {
  try {
    await requireRole("office");
    const locations = await db()`SELECT l.id, l.name, l.address, l.sort_order, COALESCE((SELECT json_agg(json_build_object('id', r.id, 'locationId', r.location_id, 'name', r.name, 'capacity', r.capacity, 'active', r.active, 'courseCount', (SELECT count(*)::int FROM courses c WHERE c.standard_room_id = r.id), 'scheduledLessonCount', (SELECT count(*)::int FROM lessons le WHERE le.room_id = r.id AND le.status = 'scheduled')) ORDER BY r.name) FROM rooms r WHERE r.location_id = l.id), '[]') AS rooms FROM locations l ORDER BY l.sort_order`;
    return NextResponse.json({ locations });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Standorte konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("office");
    const input = createLocationSchema.parse(await request.json());
    const sql = db();
    const [location] = await sql`INSERT INTO locations (id, name, address, sort_order) VALUES (${randomUUID()}, ${input.name}, ${input.address}, ${input.sortOrder}) RETURNING id, name, address, sort_order`;
    await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, after_data, actor_id) VALUES (${randomUUID()}, 'location', ${location.id}, 'created', 'Standort angelegt', ${JSON.stringify(location)}, ${actor.id})`;
    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Standortdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Name oder Reihenfolge wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Standort konnte nicht angelegt werden." }, { status: 500 });
  }
}
