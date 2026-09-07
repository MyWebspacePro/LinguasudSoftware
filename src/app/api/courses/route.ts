import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const createCourseSchema = z.object({
  code: z.string().trim().min(5).max(40).regex(/^[A-Z0-9]+$/),
  language: z.string().trim().min(2).max(60),
  level: z.enum(["A0", "A1", "A2", "B1", "B2", "C1", "C2"]),
  teacherId: z.uuid(),
  standardRoomId: z.uuid().nullable(),
  durationMinutes: z.number().int().min(15).max(360).multipleOf(15),
});

export async function GET() {
  try {
    const user = await requireRole("office", "teacher");
    const courses = user.role === "office"
      ? await db()`SELECT courses.*, users.name AS teacher_name FROM courses JOIN users ON users.id = courses.teacher_id ORDER BY courses.code`
      : await db()`SELECT courses.*, users.name AS teacher_name FROM courses JOIN users ON users.id = courses.teacher_id WHERE courses.teacher_id = ${user.id} ORDER BY courses.code`;
    return NextResponse.json({ courses });
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("office");
    const payload = createCourseSchema.parse(await request.json());
    const [course] = await db()`
      INSERT INTO courses (id, code, language, level, teacher_id, standard_room_id, duration_minutes, status)
      VALUES (${randomUUID()}, ${payload.code}, ${payload.language}, ${payload.level}, ${payload.teacherId}, ${payload.standardRoomId}, ${payload.durationMinutes}, 'planned')
      RETURNING *
    `;
    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Kursdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Kurs konnte nicht gespeichert werden." }, { status: 500 });
  }
}
