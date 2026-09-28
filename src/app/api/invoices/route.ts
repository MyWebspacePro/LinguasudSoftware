import { requireRole } from "@/lib/auth";
import { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/types";
import { jsonRoute, readJson } from "@/server/http";
import { createInvoice, invoiceCreateSchema, listInvoices } from "@/server/services/finance";

function parseStatus(value: string | null): InvoiceStatus | undefined {
  return value && (INVOICE_STATUSES as readonly string[]).includes(value) ? (value as InvoiceStatus) : undefined;
}

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin", "finance");
    const params = new URL(request.url).searchParams;
    return {
      body: {
        invoices: await listInvoices({
          period: params.get("period") ?? undefined,
          status: parseStatus(params.get("status")),
        }),
      },
    };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = invoiceCreateSchema.parse(await readJson(request));
    return { status: 201, body: { invoice: await createInvoice(actor, input) } };
  });
}
