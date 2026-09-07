import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { currentUser } from "@/lib/auth";
import { db } from "@/lib/database";

const attendanceStatusSchema = z.enum([
  "present",
  "excused",
  "unexcused",
  "trial",
  "online",
]);

const lessonIdSchema = z.uuid();
const upsertAttendanceSchema = z.object({
  lessonId: lessonIdSchema,
  entries: z
    .array(
      z.object({
        enrollmentId: z.uuid(),
        status: attendanceStatusSchema,
      }),
    )
    .min(1)
    .superRefine((entries, context) => {
      const seen = new Set<string>();
      for (const [index, entry] of entries.entries()) {
        if (seen.has(entry.enrollmentId)) {
          context.addIssue({
            code: "custom",
            message: "Jede Kursteilnahme darf nur einmal übermittelt werden.",
            path: [index, "enrollmentId"],
          });
        }
        seen.add(entry.enrollmentId);
      }
    }),
});

type AuthorizedUser = {
  id: string;
  role: "office" | "teacher";
};

async function attendanceUser(): Promise<AuthorizedUser | null> {
  const user = await currentUser();
  if (!user || (user.role !== "office" && user.role !== "teacher")) return null;
  return { id: user.id, role: user.role };
}

async function lessonForUser(lessonId: string, user: AuthorizedUser) {
  const sql = db();
  const [lesson] = user.role === "office"
    ? await sql<{ id: string; course_id: string }[]>`
        SELECT id, course_id FROM lessons WHERE id = ${lessonId}
      `
    : await sql<{ id: string; course_id: string }[]>`
        SELECT id, course_id FROM lessons WHERE id = ${lessonId} AND teacher_id = ${user.id}
      `;
  return lesson ?? null;
}

export async function GET(request: Request) {
  const lessonIdResult = lessonIdSchema.safeParse(new URL(request.url).searchParams.get("lessonId"));
  if (!lessonIdResult.success) {
    return NextResponse.json({ error: "Eine gültige lessonId ist erforderlich." }, { status: 400 });
  }

  try {
    const user = await attendanceUser();
    if (!user) return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });

    const lesson = await lessonForUser(lessonIdResult.data, user);
    if (!lesson) return NextResponse.json({ error: "Lektion nicht gefunden." }, { status: 404 });

    const sql = db();
    const attendance = await sql`
      SELECT
        enrollments.id AS enrollment_id,
        enrollments.participant_id,
        users.name AS participant_name,
        participant_profiles.first_name AS participant_first_name,
        participant_profiles.last_name AS participant_last_name,
        json_build_object('id', users.id, 'name', users.name, 'email', users.email, 'firstName', participant_profiles.first_name, 'lastName', participant_profiles.last_name) AS participant,
        courses.id AS course_id,
        courses.code AS course_code,
        courses.language AS course_language,
        courses.level AS course_level,
        attendance.id,
        attendance.status,
        attendance.confirmed_by,
        attendance.confirmed_at
      FROM enrollments
      JOIN users ON users.id = enrollments.participant_id
      LEFT JOIN participant_profiles ON participant_profiles.user_id = users.id
      JOIN courses ON courses.id = enrollments.course_id
      LEFT JOIN attendance
        ON attendance.enrollment_id = enrollments.id
        AND attendance.lesson_id = ${lesson.id}
      WHERE enrollments.course_id = ${lesson.course_id}
        AND enrollments.active = true
      ORDER BY users.name
    `;

    return NextResponse.json({ lessonId: lesson.id, attendance });
  } catch {
    return NextResponse.json({ error: "Anwesenheiten konnten nicht geladen werden." }, { status: 500 });
  }
}

async function upsertAttendance(request: Request) {
  try {
    const user = await attendanceUser();
    if (!user) return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });

    const input = upsertAttendanceSchema.parse(await request.json());
    const lesson = await lessonForUser(input.lessonId, user);
    if (!lesson) return NextResponse.json({ error: "Lektion nicht gefunden." }, { status: 404 });

    const sql = db();
    const enrollmentIds = input.entries.map((entry) => entry.enrollmentId);
    const validEnrollments = await sql<{ id: string }[]>`
      SELECT id FROM enrollments
      WHERE course_id = ${lesson.course_id}
        AND active = true
        AND id = ANY(${enrollmentIds}::uuid[])
    `;
    if (validEnrollments.length !== input.entries.length) {
      return NextResponse.json({ error: "Mindestens eine Kursteilnahme gehört nicht zu dieser Lektion." }, { status: 400 });
    }

    const attendance = await sql.begin(async (transaction) => {
      const saved = [];
      for (const entry of input.entries) {
        const [record] = await transaction`
          INSERT INTO attendance (id, lesson_id, enrollment_id, status, confirmed_by, confirmed_at)
          VALUES (${randomUUID()}, ${lesson.id}, ${entry.enrollmentId}, ${entry.status}, ${user.id}, now())
          ON CONFLICT (lesson_id, enrollment_id) DO UPDATE
          SET status = EXCLUDED.status,
              confirmed_by = EXCLUDED.confirmed_by,
              confirmed_at = EXCLUDED.confirmed_at
          RETURNING *
        `;
        saved.push(record);
      }
      return saved;
    });

    return NextResponse.json({ attendance });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Anwesenheitsdaten." }, { status: 400 });
    }
    return NextResponse.json({ error: "Anwesenheiten konnten nicht gespeichert werden." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return upsertAttendance(request);
}

export async function PUT(request: Request) {
  return upsertAttendance(request);
}
