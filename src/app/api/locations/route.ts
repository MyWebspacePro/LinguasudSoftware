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
    const locations = await db()`SELECT id, name, address, sort_order FROM locations ORDER BY sort_order`;
    return NextResponse.json({ locations });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Standorte konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("office");
    const input = createLocationSchema.parse(await request.json());
    const [location] = await db()`INSERT INTO locations (id, name, address, sort_order) VALUES (${randomUUID()}, ${input.name}, ${input.address}, ${input.sortOrder}) RETURNING id, name, address, sort_order`;
    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Standortdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Name oder Reihenfolge wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Standort konnte nicht angelegt werden." }, { status: 500 });
  }
}
