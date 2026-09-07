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
