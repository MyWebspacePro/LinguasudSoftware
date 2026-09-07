import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";
import { hashPassword } from "@/lib/passwords";

const profileFields = z.object({ phone: z.string().trim().max(40).nullable().optional(), street: z.string().trim().max(160).nullable().optional(), postalCode: z.string().trim().max(20).nullable().optional(), city: z.string().trim().max(100).nullable().optional(), teacherCode: z.string().trim().max(40).nullable().optional(), languages: z.array(z.string().trim().min(2).max(40)).max(20).optional(), specializations: z.array(z.string().trim().min(2).max(80)).max(30).optional(), notes: z.string().trim().max(5000).nullable().optional(), active: z.boolean().optional(), ratePerLesson: z.number().min(0).max(10000).nullable().optional() });
const createSchema = profileFields.extend({ name: z.string().trim().min(2).max(120), email: z.email(), password: z.string().min(12).max(256) });

export async function GET() {
  try {
    await requireRole("office");
    const teachers = await db()`SELECT u.id, u.name, u.email, u.created_at, p.teacher_code, p.phone, p.street, p.postal_code, p.city, p.languages, p.specializations, p.notes, p.active, p.rate_per_lesson, p.currency, count(c.id)::int AS course_count, (SELECT COALESCE(json_agg(json_build_object('eventType', h.event_type, 'summary', h.summary, 'occurredAt', h.occurred_at) ORDER BY h.occurred_at DESC), '[]') FROM change_history h WHERE h.entity_type = 'teacher' AND h.entity_id = u.id) AS history FROM users u LEFT JOIN teacher_profiles p ON p.user_id = u.id LEFT JOIN courses c ON c.teacher_id = u.id AND c.status NOT IN ('completed', 'cancelled') WHERE u.role = 'teacher' GROUP BY u.id, p.user_id ORDER BY u.name`;
    return NextResponse.json({ teachers });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Lehrpersonen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("office");
    const input = createSchema.parse(await request.json());
    const sql = db();
    const teacher = await sql.begin(async (transaction) => {
      const [user] = await transaction`INSERT INTO users (id, name, email, role, password_hash) VALUES (${randomUUID()}, ${input.name}, ${input.email.toLowerCase()}, 'teacher', ${hashPassword(input.password)}) RETURNING id, name, email, role`;
      await transaction`INSERT INTO teacher_profiles (user_id, teacher_code, phone, street, postal_code, city, languages, specializations, notes, active, rate_per_lesson) VALUES (${user.id}, ${input.teacherCode ?? null}, ${input.phone ?? null}, ${input.street ?? null}, ${input.postalCode ?? null}, ${input.city ?? null}, ${input.languages ?? []}, ${input.specializations ?? []}, ${input.notes ?? null}, ${input.active ?? true}, ${input.ratePerLesson ?? null})`;
      await transaction`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, after_data, actor_id) VALUES (${randomUUID()}, 'teacher', ${user.id}, 'created', 'Lehrperson angelegt', ${JSON.stringify({ ...input, password: undefined })}, ${actor.id})`;
      return user;
    });
    return NextResponse.json({ teacher }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Lehrpersonendaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "E-Mail-Adresse oder Lehrpersonenkürzel ist bereits vergeben." }, { status: 409 });
    return NextResponse.json({ error: "Lehrperson konnte nicht angelegt werden." }, { status: 500 });
  }
}
