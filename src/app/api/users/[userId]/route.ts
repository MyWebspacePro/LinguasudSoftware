import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";
import { hashPassword } from "@/lib/passwords";

const updateOfficeAccountSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().optional(),
  password: z.string().min(12).max(256).optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

/** Update a staff account without touching teacher or participant master data. */
export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { userId } = await context.params;
    const input = updateOfficeAccountSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT id, name, email, role, active FROM users WHERE id = ${userId}`;
    if (!existing || existing.role !== "office") return NextResponse.json({ error: "Bürokonto wurde nicht gefunden." }, { status: 404 });
    if (userId === actor.id && input.active === false) return NextResponse.json({ error: "Das eigene Bürokonto kann nicht deaktiviert werden." }, { status: 400 });

    const passwordHash = input.password ? hashPassword(input.password) : null;
    const [account] = await sql`
      UPDATE users SET
        name = COALESCE(${input.name ?? null}, name),
        email = COALESCE(${input.email?.toLowerCase() ?? null}, email),
        active = COALESCE(${input.active ?? null}, active),
        password_hash = COALESCE(${passwordHash}, password_hash)
      WHERE id = ${userId}
      RETURNING id, name, email, role, active, created_at
    `;
    const safeInput = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "password"));
    await sql`
      INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id)
      VALUES (${randomUUID()}, 'office_account', ${userId}, 'updated', 'Bürokonto geändert', ${JSON.stringify(existing)}, ${JSON.stringify(safeInput)}, ${actor.id})
    `;
    return NextResponse.json({ user: account });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Kontodaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Diese E-Mail-Adresse wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Bürokonto konnte nicht geändert werden." }, { status: 500 });
  }
}
