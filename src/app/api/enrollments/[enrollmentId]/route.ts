import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { db } from "@/lib/database";

const updateSchema = z.object({
  billingType: z.enum(["private", "authority"]).optional(),
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
  active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

/** Return one enrollment aggregate with stable participant, course, lesson and billing references. */
export async function GET(_request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const user = await requireRole("office", "teacher", "participant");
    const { enrollmentId } = await params;
    const sql = db();
    const [enrollment] = user.role === "office"
      ? await sql`SELECT e.*, json_build_object('id', p.id, 'name', p.name, 'email', p.email, 'firstName', pp.first_name, 'lastName', pp.last_name, 'salutation', pp.salutation, 'gender', pp.gender) AS participant, json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacher', json_build_object('id', t.id, 'name', t.name, 'email', t.email), 'standardRoomId', c.standard_room_id) AS course FROM enrollments e JOIN users p ON p.id = e.participant_id JOIN courses c ON c.id = e.course_id JOIN users t ON t.id = c.teacher_id LEFT JOIN participant_profiles pp ON pp.user_id = p.id WHERE e.id = ${enrollmentId}`
      : user.role === "teacher"
        ? await sql`SELECT e.*, json_build_object('id', p.id, 'name', p.name, 'email', p.email, 'firstName', pp.first_name, 'lastName', pp.last_name, 'salutation', pp.salutation, 'gender', pp.gender) AS participant, json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacher', json_build_object('id', t.id, 'name', t.name, 'email', t.email), 'standardRoomId', c.standard_room_id) AS course FROM enrollments e JOIN users p ON p.id = e.participant_id JOIN courses c ON c.id = e.course_id JOIN users t ON t.id = c.teacher_id LEFT JOIN participant_profiles pp ON pp.user_id = p.id WHERE e.id = ${enrollmentId} AND c.teacher_id = ${user.id}`
        : await sql`SELECT e.*, json_build_object('id', p.id, 'name', p.name, 'email', p.email, 'firstName', pp.first_name, 'lastName', pp.last_name, 'salutation', pp.salutation, 'gender', pp.gender) AS participant, json_build_object('id', c.id, 'code', c.code, 'language', c.language, 'level', c.level, 'status', c.status, 'teacher', json_build_object('id', t.id, 'name', t.name, 'email', t.email), 'standardRoomId', c.standard_room_id) AS course FROM enrollments e JOIN users p ON p.id = e.participant_id JOIN courses c ON c.id = e.course_id JOIN users t ON t.id = c.teacher_id LEFT JOIN participant_profiles pp ON pp.user_id = p.id WHERE e.id = ${enrollmentId} AND e.participant_id = ${user.id}`;
    if (!enrollment) return NextResponse.json({ error: "Kursteilnahme wurde nicht gefunden." }, { status: 404 });
    const [lessons, attendance, pauses, history] = await Promise.all([
      sql`SELECT l.id, l.course_id, l.room_id, l.teacher_id, l.starts_at, l.duration_minutes, l.status, l.cancellation_reason FROM lessons l WHERE l.course_id = ${enrollment.course_id} ORDER BY l.starts_at`,
      sql`SELECT a.id, a.lesson_id, a.enrollment_id, a.status, a.confirmed_by, a.confirmed_at FROM attendance a WHERE a.enrollment_id = ${enrollmentId} ORDER BY a.confirmed_at DESC NULLS LAST`,
      sql`SELECT id, enrollment_id, starts_on, ends_on, reason, created_by, created_at FROM enrollment_pauses WHERE enrollment_id = ${enrollmentId} ORDER BY starts_on DESC`,
      sql`SELECT h.id, h.entity_type, h.entity_id, h.event_type, h.summary, h.before_data, h.after_data, h.actor_id, h.occurred_at FROM change_history h WHERE h.entity_type = 'enrollment' AND h.entity_id = ${enrollmentId} ORDER BY h.occurred_at DESC`,
    ]);
    return NextResponse.json({ enrollment: { ...enrollment, lessons, attendance, pauses, history } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Kursteilnahme konnte nicht geladen werden." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { enrollmentId } = await params;
    const input = updateSchema.parse(await request.json());
    const sql = db();
    const [existing] = await sql`SELECT * FROM enrollments WHERE id = ${enrollmentId}`;
    if (!existing) return NextResponse.json({ error: "Kursteilnahme wurde nicht gefunden." }, { status: 404 });
    const has = (key: keyof typeof input) => Object.prototype.hasOwnProperty.call(input, key);
    const [enrollment] = await sql`
      UPDATE enrollments SET
        billing_type = CASE WHEN ${has("billingType")} THEN ${input.billingType ?? null} ELSE billing_type END,
        credit_lessons = CASE WHEN ${has("creditLessons")} THEN ${input.creditLessons ?? null} ELSE credit_lessons END,
        payment_status = CASE WHEN ${has("paymentStatus")} THEN ${input.paymentStatus ?? null} ELSE payment_status END,
        purchased_amount = CASE WHEN ${has("purchasedAmount")} THEN ${input.purchasedAmount ?? null} ELSE purchased_amount END,
        payer_name = CASE WHEN ${has("payerName")} THEN ${input.payerName ?? null} ELSE payer_name END,
        case_reference = CASE WHEN ${has("caseReference")} THEN ${input.caseReference ?? null} ELSE case_reference END,
        approved_lessons = CASE WHEN ${has("approvedLessons")} THEN ${input.approvedLessons ?? null} ELSE approved_lessons END,
        approved_amount = CASE WHEN ${has("approvedAmount")} THEN ${input.approvedAmount ?? null} ELSE approved_amount END,
        valid_from = CASE WHEN ${has("validFrom")} THEN ${input.validFrom ?? null} ELSE valid_from END,
        valid_until = CASE WHEN ${has("validUntil")} THEN ${input.validUntil ?? null} ELSE valid_until END,
        tariff = CASE WHEN ${has("tariff")} THEN ${input.tariff ?? null} ELSE tariff END,
        invoice_recipient = CASE WHEN ${has("invoiceRecipient")} THEN ${input.invoiceRecipient ?? null} ELSE invoice_recipient END,
        active = CASE WHEN ${has("active")} THEN ${input.active ?? null} ELSE active END
      WHERE id = ${enrollmentId}
      RETURNING *
    `;
    await sql`INSERT INTO change_history (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id) VALUES (${randomUUID()}, 'enrollment', ${enrollmentId}, 'updated', 'Teilnahme- und Abrechnungsdaten geändert', ${JSON.stringify(existing)}, ${JSON.stringify(input)}, ${actor.id})`;
    return NextResponse.json({ enrollment });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Ungültige Abrechnungsdaten." }, { status: 400 });
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Abrechnungsdaten konnten nicht gespeichert werden." }, { status: 500 });
  }
}

/**
 * End a course participation without deleting its record. Keeping the
 * enrollment row preserves billing and attendance history while removing the
 * person from the course's active roster.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  try {
    const actor = await requireRole("office");
    const { enrollmentId } = await params;
    const sql = db();
    const [existing] = await sql`
      SELECT enrollments.*, courses.code AS course_code, participants.name AS participant_name
      FROM enrollments
      JOIN courses ON courses.id = enrollments.course_id
      JOIN users AS participants ON participants.id = enrollments.participant_id
      WHERE enrollments.id = ${enrollmentId}
    `;
    if (!existing) return NextResponse.json({ error: "Kursteilnahme wurde nicht gefunden." }, { status: 404 });
    if (!existing.active) return NextResponse.json({ enrollment: existing });

    const [enrollment] = await sql`
      UPDATE enrollments
      SET active = false
      WHERE id = ${enrollmentId}
      RETURNING *
    `;
    await sql`
      INSERT INTO change_history
        (id, entity_type, entity_id, event_type, summary, before_data, after_data, actor_id)
      VALUES
        (${randomUUID()}, 'enrollment', ${enrollmentId}, 'removed',
         ${`Teilnahme ${existing.participant_name} aus ${existing.course_code} entfernt`},
         ${JSON.stringify(existing)}, ${JSON.stringify(enrollment)}, ${actor.id})
    `;
    return NextResponse.json({ enrollment });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Nicht berechtigt." }, { status: 403 });
    return NextResponse.json({ error: "Teilnahme konnte nicht beendet werden." }, { status: 500 });
  }
}
