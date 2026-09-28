export const ORGANIZATION_KINDS = ["company", "authority", "parent", "other"] as const;

export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

export type Organization = {
  id: string;
  kind: OrganizationKind;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  addressExtra: string | null;
  customerNumber: string | null;
  invoiceRecipient: string | null;
  notes: string | null;
  active: boolean;
};
