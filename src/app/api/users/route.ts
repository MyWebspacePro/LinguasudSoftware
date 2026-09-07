import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";
import { hashPassword } from "@/lib/passwords";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(["office", "teacher", "participant"]),
  password: z.string().min(12).max(256),
});

export async function GET(request: Request) {
  try {
    await requireRole("office");
    const role = new URL(request.url).searchParams.get("role");
    const users = role && ["office", "teacher", "participant"].includes(role)
      ? await db()`SELECT id, name, email, role, active, created_at FROM users WHERE role = ${role} ORDER BY active DESC, name`
      : await db()`SELECT id, name, email, role, active, created_at FROM users ORDER BY role, active DESC, name`;
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Benutzer konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("office");
    const input = createUserSchema.parse(await request.json());
    const [user] = await db()`
      INSERT INTO users (id, name, email, role, password_hash)
      VALUES (${randomUUID()}, ${input.name}, ${input.email}, ${input.role}, ${hashPassword(input.password)})
      RETURNING id, name, email, role, active, created_at
    `;
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Benutzerdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Diese E-Mail-Adresse wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Benutzerkonto konnte nicht angelegt werden." }, { status: 500 });
  }
}
