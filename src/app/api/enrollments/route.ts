import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const createEnrollmentSchema = z.object({
  courseId: z.uuid(),
  participantId: z.uuid(),
  billingType: z.enum(["private", "authority"]),
  creditLessons: z.number().int().min(0).max(999).nullable().optional(),
  paymentStatus: z.enum(["open", "partially_paid", "paid", "overdue"]).optional(),
  purchasedAmount: z.number().min(0).max(1_000_000).nullable().optional(),
  payerName: z.string().trim().max(160).nullable().optional(),
  caseReference: z.string().trim().max(160).nullable().optional(),
  approvedLessons: z.number().int().min(0).max(9999).nullable().optional(),
  approvedAmount: z.number().min(0).max(1_000_000).nullable().optional(),
  validFrom: z.string().date().nullable().optional(),
  validUntil: z.string().date().nullable().optional(),
  tariff: z.number().min(0).max(10000).nullable().optional(),
  invoiceRecipient: z.string().trim().max(160).nullable().optional(),
});

export async function GET() {
  try {
    const user = await requireRole("office", "teacher", "participant");
    const sql = db();
    const enrollments = user.role === "office"
      ? await sql`
          SELECT enrollments.*, courses.code AS course_code, courses.language AS course_language,
                 courses.level AS course_level, courses.status AS course_status,
                 participants.name AS participant_name, participants.email AS participant_email,
                 (SELECT json_build_object(
                    'present', count(*) FILTER (WHERE a.status = 'present')::int,
                    'excused', count(*) FILTER (WHERE a.status = 'excused')::int,
                    'unexcused', count(*) FILTER (WHERE a.status = 'unexcused')::int,
                    'online', count(*) FILTER (WHERE a.status = 'online')::int,
                    'trial', count(*) FILTER (WHERE a.status = 'trial')::int
                  ) FROM attendance a WHERE a.enrollment_id = enrollments.id) AS attendance_summary,
                 COALESCE((SELECT json_agg(json_build_object('id', p.id, 'startsOn', p.starts_on, 'endsOn', p.ends_on, 'reason', p.reason) ORDER BY p.starts_on DESC) FROM enrollment_pauses p WHERE p.enrollment_id = enrollments.id), '[]') AS pauses
          FROM enrollments
          JOIN courses ON courses.id = enrollments.course_id
          JOIN users AS participants ON participants.id = enrollments.participant_id
          ORDER BY participants.name, courses.code
        `
      : user.role === "teacher"
        ? await sql`
            SELECT enrollments.*, courses.code AS course_code, courses.language AS course_language,
                   courses.level AS course_level, courses.status AS course_status,
                   participants.name AS participant_name, participants.email AS participant_email,
                   (SELECT json_build_object(
                      'present', count(*) FILTER (WHERE a.status = 'present')::int,
                      'excused', count(*) FILTER (WHERE a.status = 'excused')::int,
                      'unexcused', count(*) FILTER (WHERE a.status = 'unexcused')::int,
                      'online', count(*) FILTER (WHERE a.status = 'online')::int,
                      'trial', count(*) FILTER (WHERE a.status = 'trial')::int
                    ) FROM attendance a WHERE a.enrollment_id = enrollments.id) AS attendance_summary,
                   COALESCE((SELECT json_agg(json_build_object('id', p.id, 'startsOn', p.starts_on, 'endsOn', p.ends_on, 'reason', p.reason) ORDER BY p.starts_on DESC) FROM enrollment_pauses p WHERE p.enrollment_id = enrollments.id), '[]') AS pauses
            FROM enrollments
            JOIN courses ON courses.id = enrollments.course_id
            JOIN users AS participants ON participants.id = enrollments.participant_id
            WHERE courses.teacher_id = ${user.id}
            ORDER BY participants.name, courses.code
          `
        : await sql`
            SELECT enrollments.*, courses.code AS course_code, courses.language AS course_language,
                   courses.level AS course_level, courses.status AS course_status,
                   (SELECT json_build_object(
                      'present', count(*) FILTER (WHERE a.status = 'present')::int,
                      'excused', count(*) FILTER (WHERE a.status = 'excused')::int,
                      'unexcused', count(*) FILTER (WHERE a.status = 'unexcused')::int,
                      'online', count(*) FILTER (WHERE a.status = 'online')::int,
                      'trial', count(*) FILTER (WHERE a.status = 'trial')::int
                    ) FROM attendance a WHERE a.enrollment_id = enrollments.id) AS attendance_summary,
                   COALESCE((SELECT json_agg(json_build_object('id', p.id, 'startsOn', p.starts_on, 'endsOn', p.ends_on, 'reason', p.reason) ORDER BY p.starts_on DESC) FROM enrollment_pauses p WHERE p.enrollment_id = enrollments.id), '[]') AS pauses
            FROM enrollments
            JOIN courses ON courses.id = enrollments.course_id
            WHERE enrollments.participant_id = ${user.id}
            ORDER BY courses.code
          `;
    return NextResponse.json({ enrollments });
  } catch {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("office");
    const input = createEnrollmentSchema.parse(await request.json());
    const sql = db();

    const [course] = await sql`SELECT id FROM courses WHERE id = ${input.courseId}`;
    if (!course) return NextResponse.json({ error: "Kurs wurde nicht gefunden." }, { status: 404 });

    const [participant] = await sql`
      SELECT id FROM users WHERE id = ${input.participantId} AND role = 'participant'
    `;
    if (!participant) return NextResponse.json({ error: "Teilnehmende Person wurde nicht gefunden." }, { status: 404 });

    const [existingEnrollment] = await sql`
      SELECT * FROM enrollments
      WHERE course_id = ${input.courseId} AND participant_id = ${input.participantId}
    `;
    if (existingEnrollment?.active) {
      return NextResponse.json({ error: "Die Person ist bereits in diesem Kurs eingeschrieben." }, { status: 409 });
    }
    if (existingEnrollment) {
      const [enrollment] = await sql`
        UPDATE enrollments SET
          billing_type = ${input.billingType},
          credit_lessons = ${input.creditLessons ?? null},
          payment_status = ${input.paymentStatus ?? "open"},
          purchased_amount = ${input.purchasedAmount ?? null},
          payer_name = ${input.payerName ?? null},
          case_reference = ${input.caseReference ?? null},
          approved_lessons = ${input.approvedLessons ?? null},
          approved_amount = ${input.approvedAmount ?? null},
          valid_from = ${input.validFrom ?? null},
          valid_until = ${input.validUntil ?? null},
          tariff = ${input.tariff ?? null},
          invoice_recipient = ${input.invoiceRecipient ?? null},
          active = true
        WHERE id = ${existingEnrollment.id}
        RETURNING *
      `;
      await sql`
        INSERT INTO change_history
          (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id)
        VALUES
          (${randomUUID()}, 'enrollment', ${existingEnrollment.id}, 'reactivated',
           'Teilnahme erneut aktiviert', ${JSON.stringify(existingEnrollment)}, ${JSON.stringify(enrollment)}, ${actor.id})
      `;
      return NextResponse.json({ enrollment });
    }

    const [enrollment] = await sql`
      INSERT INTO enrollments (id, course_id, participant_id, billing_type, credit_lessons, payment_status, purchased_amount, payer_name, case_reference, approved_lessons, approved_amount, valid_from, valid_until, tariff, invoice_recipient)
      VALUES (${randomUUID()}, ${input.courseId}, ${input.participantId}, ${input.billingType}, ${input.creditLessons ?? null}, ${input.paymentStatus ?? "open"}, ${input.purchasedAmount ?? null}, ${input.payerName ?? null}, ${input.caseReference ?? null}, ${input.approvedLessons ?? null}, ${input.approvedAmount ?? null}, ${input.validFrom ?? null}, ${input.validUntil ?? null}, ${input.tariff ?? null}, ${input.invoiceRecipient ?? null})
      RETURNING *
    `;
    await sql`
      INSERT INTO change_history
        (id, entity_type, entity_id, event_type, summary, after_data, actor_id)
      VALUES
        (${randomUUID()}, 'enrollment', ${enrollment.id}, 'created',
         'Teilnahme angelegt', ${JSON.stringify(enrollment)}, ${actor.id})
    `;
    return NextResponse.json({ enrollment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Teilnahmedaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Die Person ist bereits in diesem Kurs eingeschrieben." }, { status: 409 });
    }
    return NextResponse.json({ error: "Kursteilnahme konnte nicht gespeichert werden." }, { status: 500 });
  }
}
