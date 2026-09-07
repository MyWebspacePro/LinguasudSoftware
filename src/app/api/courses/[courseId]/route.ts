import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const levelSchema = z.enum(["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
const updateCourseSchema = z.object({
  level: levelSchema.optional(),
  code: z.string().trim().min(5).max(40).regex(/^[A-Z0-9]+$/).optional(),
}).refine((value) => value.level !== undefined || value.code !== undefined, { message: "Mindestens eine Änderung ist erforderlich." });

export async function PATCH(request: Request, context: { params: Promise<{ courseId: string }> }) {
  try {
    const user = await requireRole("office", "teacher");
    const { courseId } = await context.params;
    const input = updateCourseSchema.parse(await request.json());
    if (input.code && user.role !== "office") return NextResponse.json({ error: "Nur das Büro darf Kurskennungen ändern." }, { status: 403 });
    const [course] = user.role === "office"
      ? await db()`SELECT id FROM courses WHERE id = ${courseId}`
      : await db()`SELECT id FROM courses WHERE id = ${courseId} AND teacher_id = ${user.id}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });
    const [updated] = await db()`UPDATE courses SET level = COALESCE(${input.level ?? null}, level), code = COALESCE(${input.code ?? null}, code) WHERE id = ${courseId} RETURNING *`;
    return NextResponse.json({ course: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Kursdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return NextResponse.json({ error: "Diese Kurskennung wird bereits verwendet." }, { status: 409 });
    return NextResponse.json({ error: "Kurs konnte nicht geändert werden." }, { status: 500 });
  }
}
