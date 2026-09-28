import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { INVOICE_KINDS, INVOICE_STATUSES } from "@/lib/types";
import type { FinanceOverview, Invoice, PayrollEntry } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { pushInvoiceToBexio } from "@/server/bexio";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import * as repo from "@/server/repositories/finance";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.");
const periodString = z.string().regex(/^\d{4}-\d{2}$/, "Periode muss im Format YYYY-MM sein.");

export const invoiceCreateSchema = z.object({
  enrollmentId: z.uuid().nullish(),
  organizationId: z.uuid().nullish(),
  kind: z.enum(INVOICE_KINDS).default("other"),
  number: z.string().trim().max(60).nullish(),
  amountChf: z.number().min(0).max(1000000),
  status: z.enum(INVOICE_STATUSES).default("draft"),
  issuedOn: dateString.nullish(),
  dueOn: dateString.nullish(),
  period: periodString.nullish(),
});

export const invoiceUpdateSchema = z
  .object({
    status: z.enum(INVOICE_STATUSES).optional(),
    number: z.string().trim().max(60).nullish(),
    issuedOn: dateString.nullish(),
    dueOn: dateString.nullish(),
    paidOn: dateString.nullish(),
    sync: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export const payrollCalcSchema = z.object({ period: periodString });

export function listInvoices(filter: repo.InvoiceListFilter): Promise<Invoice[]> {
  return repo.listInvoices(db(), filter);
}

export async function createInvoice(actor: SessionUser, input: z.infer<typeof invoiceCreateSchema>): Promise<Invoice> {
  return db().begin(async (tx) => {
    const id = await repo.insertInvoice(tx, {
      enrollmentId: input.enrollmentId ?? null,
      organizationId: input.organizationId ?? null,
      kind: input.kind,
      number: input.number ?? null,
      amountChf: input.amountChf,
      status: input.status,
      issuedOn: input.issuedOn ?? null,
      dueOn: input.dueOn ?? null,
      period: input.period ?? null,
    });
    await recordChange(tx, {
      entityType: "invoice",
      entityId: id,
      eventType: "created",
      summary: `Rechnung über ${input.amountChf.toFixed(2)} CHF angelegt`,
      actorId: actor.id,
    });
    const invoice = await repo.getInvoice(tx, id);
    if (!invoice) throw notFound("Rechnung konnte nicht angelegt werden.");
    return invoice;
  });
}

export async function updateInvoice(
  actor: SessionUser,
  id: string,
  patch: z.infer<typeof invoiceUpdateSchema>,
): Promise<Invoice> {
  return db().begin(async (tx) => {
    const before = await repo.getInvoice(tx, id);
    if (!before) throw notFound("Rechnung wurde nicht gefunden.");

    const paidOn = patch.status === "paid" && !patch.paidOn ? new Date().toISOString().slice(0, 10) : patch.paidOn;
    const change: Parameters<typeof repo.updateInvoice>[2] = {};
    if (patch.status !== undefined) change.status = patch.status;
    if (patch.number !== undefined) change.number = patch.number;
    if (patch.issuedOn !== undefined) change.issuedOn = patch.issuedOn;
    if (patch.dueOn !== undefined) change.dueOn = patch.dueOn;
    if (paidOn !== undefined) change.paidOn = paidOn;
    await repo.updateInvoice(tx, id, change);

    if (patch.sync) {
      const current = await repo.getInvoice(tx, id);
      if (current) {
        const result = await pushInvoiceToBexio(current);
        if (result.synced && result.bexioId) {
          await repo.updateInvoice(tx, id, { bexioInvoiceId: result.bexioId });
        }
      }
    }

    await recordChange(tx, {
      entityType: "invoice",
      entityId: id,
      eventType: "updated",
      summary: patch.status ? `Rechnung auf ${patch.status} gesetzt` : "Rechnung geändert",
      before,
      actorId: actor.id,
    });
    const invoice = await repo.getInvoice(tx, id);
    if (!invoice) throw notFound("Rechnung wurde nicht gefunden.");
    return invoice;
  });
}

export function listPayroll(period: string): Promise<PayrollEntry[]> {
  return repo.listPayroll(db(), period);
}

export async function materializePayroll(actor: SessionUser, period: string): Promise<PayrollEntry[]> {
  return db().begin(async (tx) => {
    const aggregates = await repo.listPerformedLessonsForMonth(tx, period);
    for (const aggregate of aggregates) {
      await repo.upsertPayroll(tx, {
        teacherId: aggregate.teacherId,
        period,
        amountChf: aggregate.amountChf,
        lessonsCount: aggregate.lessonsCount,
      });
    }
    await recordChange(tx, {
      entityType: "payroll",
      entityId: actor.id,
      eventType: "calculated",
      summary: `Honorare ${period} berechnet (${aggregates.length} Lehrpersonen)`,
      actorId: actor.id,
    });
    return repo.listPayroll(tx, period);
  });
}

export async function markPayrollPaid(actor: SessionUser, id: string): Promise<PayrollEntry[]> {
  await repo.markPayrollPaid(db(), id, actor.id);
  const [entry] = await db()<{ period: string }[]>`SELECT period FROM teacher_payroll WHERE id = ${id}`;
  if (!entry) throw notFound("Honorar wurde nicht gefunden.");
  return repo.listPayroll(db(), entry.period);
}

export function financeOverview(period: string): Promise<FinanceOverview> {
  return repo.financeOverview(db(), period);
}
