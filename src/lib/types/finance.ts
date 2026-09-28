export const INVOICE_KINDS = ["package", "monthly", "other"] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type Invoice = {
  id: string;
  enrollmentId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  kind: InvoiceKind;
  number: string | null;
  amountChf: number;
  status: InvoiceStatus;
  issuedOn: string | null;
  dueOn: string | null;
  paidOn: string | null;
  period: string | null;
  bexioInvoiceId: string | null;
  createdAt: string;
};

export type TeacherRate = {
  id: string;
  teacherId: string;
  courseSizeKindId: string;
  courseSizeKindName: string;
  rateChf: number;
};

export type PayrollEntry = {
  id: string | null;
  teacherId: string;
  teacherName: string;
  period: string;
  amountChf: number;
  lessonsCount: number;
  paidAt: string | null;
};

export type FinanceOverview = {
  period: string;
  revenueChf: number;
  openChf: number;
  honorarChf: number;
  invoiceCount: number;
  paidCount: number;
  openCount: number;
  revenueByKind: { kind: InvoiceKind; amountChf: number }[];
};
