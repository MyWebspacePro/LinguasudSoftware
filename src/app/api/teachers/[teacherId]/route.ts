import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const updateSchema = z.object({ name: z.string().trim().min(2).max(120).optional(), email: z.email().optional(), phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(), postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), teacherCode: z.string().trim().max(40).nullable().optional(), languages: z.array(z.string().trim().min(2).max(40)).max(20).optional(), specializations: z.array(z.string().trim().min(2).max(80)).max(30).optional(), notes: z.string().trim().max(5000).nullable().optional(), active: z.boolean().optional(), ratePerLesson: z.number().min(0).max(10000).nullable().optional() }).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, context: { params: Promise<{ teacherId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { teacherId } = await context.params;
    const input = updateSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT u.id, u.name, u.email, p.* FROM users u LEFT JOIN teacher_profiles p ON p.user_id = u.id WHERE u.id = ${teacherId} AND u.role = 'teacher'`;
    if (!existing) return NextResponse.json({ error: "Lehrperson wurde nicht gefunden." }, { status: 404 });
    const teacher = await sql.begin(async (transaction) => {
      const [user] = await transaction`UPDATE users SET name = COALESCE(${input.name ?? null}, name), email = COALESCE(${input.email?.toLowerCase() ?? null}, email) WHERE id = ${teacherId} RETURNING id, name, email, role`;
      const [profile] = await transaction`INSERT INTO teacher_profiles (user_id) VALUES (${teacherId}) ON CONFLICT (user_id) DO UPDATE SET phone = COALESCE(${input.phone ?? null}, teacher_profiles.phone), street = COALESCE(${input.street ?? null}, teacher_profiles.street), postal_code = COALESCE(${input.postalCode ?? null}, teacher_profiles.postal_code), city = COALESCE(${input.city ?? null}, teacher_profiles.city), teacher_code = COALESCE(${input.teacherCode ?? null}, teacher_profiles.teacher_code), languages = COALESCE(${input.languages ?? null}, teacher_profiles.languages), specializations = COALESCE(${input.specializations ?? null}, teacher_profiles.specializations), notes = COALESCE(${input.notes ?? null}, teacher_profiles.notes), active = COALESCE(${input.active ?? null}, teacher_profiles.active), rate_per_lesson = COALESCE(${input.ratePerLesson ?? null}, teacher_profiles.rate_per_lesson), updated_at = now() RETURNING *`;
      await transaction`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'teacher', ${teacherId}, 'updated', 'Lehrpersonendaten geändert', ${JSON.stringify(existing)}, ${JSON.stringify(input)}, ${actor.id})`;
      return { ...user, ...profile };
    });
    return NextResponse.json({ teacher });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Lehrpersonendaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Dieses Lehrpersonenkürzel oder diese E-Mail ist bereits vergeben." }, { status: 409 });
    return NextResponse.json({ error: "Lehrpersonendaten konnten nicht geändert werden." }, { status: 500 });
  }
}
