import "server-only";

import type { FinanceOverview, Invoice, InvoiceKind, InvoiceStatus, PayrollEntry } from "@/lib/types";
import type { Sql } from "@/server/db";

type InvoiceRow = {
  id: string;
  enrollment_id: string | null;
  organization_id: string | null;
  organization_name: string | null;
  kind: InvoiceKind;
  number: string | null;
  amount_chf: string;
  status: InvoiceStatus;
  issued_on: string | null;
  due_on: string | null;
  paid_on: string | null;
  period: string | null;
  bexio_invoice_id: string | null;
  created_at: Date;
};

const toInvoice = (row: InvoiceRow): Invoice => ({
  id: row.id,
  enrollmentId: row.enrollment_id,
  organizationId: row.organization_id,
  organizationName: row.organization_name,
  kind: row.kind,
  number: row.number,
  amountChf: Number(row.amount_chf),
  status: row.status,
  issuedOn: row.issued_on,
  dueOn: row.due_on,
  paidOn: row.paid_on,
  period: row.period,
  bexioInvoiceId: row.bexio_invoice_id,
  createdAt: row.created_at.toISOString(),
});

export type InvoiceListFilter = { period?: string; status?: InvoiceStatus; organizationId?: string };

export async function listInvoices(sql: Sql, filter: InvoiceListFilter = {}): Promise<Invoice[]> {
  const rows = await sql<InvoiceRow[]>`
    SELECT invoices.id, invoices.enrollment_id, invoices.organization_id, organizations.name AS organization_name,
           invoices.kind, invoices.number, invoices.amount_chf, invoices.status,
           to_char(invoices.issued_on, 'YYYY-MM-DD') AS issued_on, to_char(invoices.due_on, 'YYYY-MM-DD') AS due_on,
           to_char(invoices.paid_on, 'YYYY-MM-DD') AS paid_on, invoices.period, invoices.bexio_invoice_id, invoices.created_at
    FROM invoices
    LEFT JOIN organizations ON organizations.id = invoices.organization_id
    WHERE (${filter.period ?? null}::text IS NULL OR invoices.period = ${filter.period ?? null})
      AND (${filter.status ?? null}::text IS NULL OR invoices.status = ${filter.status ?? null})
      AND (${filter.organizationId ?? null}::uuid IS NULL OR invoices.organization_id = ${filter.organizationId ?? null})
    ORDER BY invoices.created_at DESC
  `;
  return rows.map(toInvoice);
}

export async function getInvoice(sql: Sql, id: string): Promise<Invoice | null> {
  const rows = await listInvoices(sql);
  return rows.find((invoice) => invoice.id === id) ?? null;
}

export type InvoiceInput = {
  enrollmentId: string | null;
  organizationId: string | null;
  kind: InvoiceKind;
  number: string | null;
  amountChf: number;
  status: InvoiceStatus;
  issuedOn: string | null;
  dueOn: string | null;
  period: string | null;
};

export async function insertInvoice(sql: Sql, input: InvoiceInput): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO invoices (enrollment_id, organization_id, kind, number, amount_chf, status, issued_on, due_on, period)
    VALUES (${input.enrollmentId}, ${input.organizationId}, ${input.kind}, ${input.number}, ${input.amountChf}, ${input.status}, ${input.issuedOn}, ${input.dueOn}, ${input.period})
    RETURNING id
  `;
  return row.id;
}

export async function updateInvoice(
  sql: Sql,
  id: string,
  patch: { status?: InvoiceStatus; number?: string | null; issuedOn?: string | null; dueOn?: string | null; paidOn?: string | null; bexioInvoiceId?: string | null },
): Promise<void> {
  const has = (key: keyof typeof patch) => Object.prototype.hasOwnProperty.call(patch, key);
  await sql`
    UPDATE invoices SET
      status = CASE WHEN ${has("status")} THEN ${patch.status ?? null} ELSE status END,
      number = CASE WHEN ${has("number")} THEN ${patch.number ?? null} ELSE number END,
      issued_on = CASE WHEN ${has("issuedOn")} THEN ${patch.issuedOn ?? null} ELSE issued_on END,
      due_on = CASE WHEN ${has("dueOn")} THEN ${patch.dueOn ?? null} ELSE due_on END,
      paid_on = CASE WHEN ${has("paidOn")} THEN ${patch.paidOn ?? null} ELSE paid_on END,
      bexio_invoice_id = CASE WHEN ${has("bexioInvoiceId")} THEN ${patch.bexioInvoiceId ?? null} ELSE bexio_invoice_id END
    WHERE id = ${id}
  `;
}

export type PerformedLessonAggregate = { teacherId: string; teacherName: string; lessonsCount: number; amountChf: number };

export async function listPerformedLessonsForMonth(sql: Sql, period: string): Promise<PerformedLessonAggregate[]> {
  const rows = await sql<{ teacher_id: string; teacher_name: string; lessons_count: number; amount_chf: string }[]>`
    SELECT lessons.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
           count(*)::int AS lessons_count,
           COALESCE(sum(rates.rate_chf), 0) AS amount_chf
    FROM lessons
    JOIN courses ON courses.id = lessons.course_id
    JOIN users teacher ON teacher.id = lessons.teacher_id
    LEFT JOIN teacher_rates rates ON rates.teacher_id = lessons.teacher_id AND rates.course_size_kind_id = courses.course_size_kind_id
    WHERE lessons.status = 'completed'
      AND to_char(lessons.starts_at AT TIME ZONE 'Europe/Zurich', 'YYYY-MM') = ${period}
    GROUP BY lessons.teacher_id, teacher.first_name, teacher.last_name
    ORDER BY teacher.last_name, teacher.first_name
  `;
  return rows.map((row) => ({
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    lessonsCount: row.lessons_count,
    amountChf: Number(row.amount_chf),
  }));
}

type PayrollRow = {
  id: string | null;
  teacher_id: string;
  teacher_name: string;
  period: string;
  amount_chf: string;
  lessons_count: number;
  paid_at: Date | null;
};

export async function listPayroll(sql: Sql, period: string): Promise<PayrollEntry[]> {
  const rows = await sql<PayrollRow[]>`
    SELECT payroll.id, performed.teacher_id, performed.teacher_name, ${period} AS period,
           COALESCE(payroll.amount_chf, performed.amount_chf) AS amount_chf,
           COALESCE(payroll.lessons_count, performed.lessons_count) AS lessons_count,
           payroll.paid_at
    FROM (
      SELECT lessons.teacher_id, teacher.first_name || ' ' || teacher.last_name AS teacher_name,
             count(*)::int AS lessons_count, COALESCE(sum(rates.rate_chf), 0) AS amount_chf
      FROM lessons
      JOIN courses ON courses.id = lessons.course_id
      JOIN users teacher ON teacher.id = lessons.teacher_id
      LEFT JOIN teacher_rates rates ON rates.teacher_id = lessons.teacher_id AND rates.course_size_kind_id = courses.course_size_kind_id
      WHERE lessons.status = 'completed'
        AND to_char(lessons.starts_at AT TIME ZONE 'Europe/Zurich', 'YYYY-MM') = ${period}
      GROUP BY lessons.teacher_id, teacher.first_name, teacher.last_name
    ) performed
    LEFT JOIN teacher_payroll payroll ON payroll.teacher_id = performed.teacher_id AND payroll.period = ${period}
    ORDER BY performed.teacher_name
  `;
  return rows.map((row) => ({
    id: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    period: row.period,
    amountChf: Number(row.amount_chf),
    lessonsCount: row.lessons_count,
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
  }));
}

export async function upsertPayroll(
  sql: Sql,
  input: { teacherId: string; period: string; amountChf: number; lessonsCount: number },
): Promise<void> {
  await sql`
    INSERT INTO teacher_payroll (teacher_id, period, amount_chf, lessons_count)
    VALUES (${input.teacherId}, ${input.period}, ${input.amountChf}, ${input.lessonsCount})
    ON CONFLICT (teacher_id, period) DO UPDATE SET amount_chf = EXCLUDED.amount_chf, lessons_count = EXCLUDED.lessons_count, updated_at = now()
  `;
}

export async function markPayrollPaid(sql: Sql, id: string, userId: string): Promise<void> {
  await sql`UPDATE teacher_payroll SET paid_at = now(), paid_by = ${userId} WHERE id = ${id}`;
}

export async function financeOverview(sql: Sql, period: string): Promise<FinanceOverview> {
  const [invoices] = await sql<{ count: number; paid: number; open_count: number; revenue: string; open: string }[]>`
    SELECT count(*)::int AS count,
           count(*) FILTER (WHERE status = 'paid')::int AS paid,
           count(*) FILTER (WHERE status IN ('draft', 'sent', 'overdue'))::int AS open_count,
           COALESCE(sum(amount_chf) FILTER (WHERE status = 'paid'), 0) AS revenue,
           COALESCE(sum(amount_chf) FILTER (WHERE status IN ('draft', 'sent', 'overdue')), 0) AS open
    FROM invoices
    WHERE period = ${period}
  `;

  const byKind = await sql<{ kind: InvoiceKind; amount: string }[]>`
    SELECT kind, COALESCE(sum(amount_chf) FILTER (WHERE status = 'paid'), 0) AS amount
    FROM invoices WHERE period = ${period} GROUP BY kind
  `;

  const [honorar] = await sql<{ total: string }[]>`
    SELECT COALESCE(sum(amount_chf), 0) AS total FROM teacher_payroll WHERE period = ${period}
  `;

  return {
    period,
    revenueChf: Number(invoices?.revenue ?? 0),
    openChf: Number(invoices?.open ?? 0),
    honorarChf: Number(honorar?.total ?? 0),
    invoiceCount: invoices?.count ?? 0,
    paidCount: invoices?.paid ?? 0,
    openCount: invoices?.open_count ?? 0,
    revenueByKind: byKind.map((row) => ({ kind: row.kind, amountChf: Number(row.amount) })),
  };
}
