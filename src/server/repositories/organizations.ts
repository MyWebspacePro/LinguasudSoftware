import "server-only";

import type { Organization, OrganizationKind } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  kind: OrganizationKind;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  address_extra: string | null;
  customer_number: string | null;
  invoice_recipient: string | null;
  notes: string | null;
  active: boolean;
};

const toOrganization = (row: Row): Organization => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  contactName: row.contact_name,
  email: row.email,
  phone: row.phone,
  street: row.street,
  postalCode: row.postal_code,
  city: row.city,
  addressExtra: row.address_extra,
  customerNumber: row.customer_number,
  invoiceRecipient: row.invoice_recipient,
  notes: row.notes,
  active: row.active,
});

export type OrganizationListFilter = {
  kind?: OrganizationKind;
  includeInactive?: boolean;
};

export async function listOrganizations(sql: Sql, filter: OrganizationListFilter = {}): Promise<Organization[]> {
  const includeInactive = filter.includeInactive === true;
  const rows = await sql<Row[]>`
    SELECT id, kind, name, contact_name, email, phone, street, postal_code, city, address_extra, customer_number, invoice_recipient, notes, active
    FROM organizations
    WHERE (active = true OR ${includeInactive})
      AND (${filter.kind ?? null}::text IS NULL OR kind = ${filter.kind ?? null})
    ORDER BY name
  `;
  return rows.map(toOrganization);
}

export async function getOrganization(sql: Sql, id: string): Promise<Organization | null> {
  const [row] = await sql<Row[]>`
    SELECT id, kind, name, contact_name, email, phone, street, postal_code, city, address_extra, customer_number, invoice_recipient, notes, active
    FROM organizations
    WHERE id = ${id}
  `;
  return row ? toOrganization(row) : null;
}

export type OrganizationInput = {
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
};

export async function insertOrganization(sql: Sql, input: OrganizationInput): Promise<Organization> {
  const [row] = await sql<Row[]>`
    INSERT INTO organizations (kind, name, contact_name, email, phone, street, postal_code, city, address_extra, customer_number, invoice_recipient, notes)
    VALUES (
      ${input.kind}, ${input.name}, ${input.contactName}, ${input.email}, ${input.phone}, ${input.street},
      ${input.postalCode}, ${input.city}, ${input.addressExtra}, ${input.customerNumber}, ${input.invoiceRecipient}, ${input.notes}
    )
    RETURNING id, kind, name, contact_name, email, phone, street, postal_code, city, address_extra, customer_number, invoice_recipient, notes, active
  `;
  return toOrganization(row);
}

export type OrganizationPatch = Partial<OrganizationInput> & { active?: boolean };

export async function updateOrganization(sql: Sql, id: string, patch: OrganizationPatch): Promise<Organization | null> {
  const has = (key: keyof OrganizationPatch) => Object.prototype.hasOwnProperty.call(patch, key);
  const [row] = await sql<Row[]>`
    UPDATE organizations SET
      kind = CASE WHEN ${has("kind")} THEN ${patch.kind ?? null} ELSE kind END,
      name = CASE WHEN ${has("name")} THEN ${patch.name ?? null} ELSE name END,
      contact_name = CASE WHEN ${has("contactName")} THEN ${patch.contactName ?? null} ELSE contact_name END,
      email = CASE WHEN ${has("email")} THEN ${patch.email ?? null} ELSE email END,
      phone = CASE WHEN ${has("phone")} THEN ${patch.phone ?? null} ELSE phone END,
      street = CASE WHEN ${has("street")} THEN ${patch.street ?? null} ELSE street END,
      postal_code = CASE WHEN ${has("postalCode")} THEN ${patch.postalCode ?? null} ELSE postal_code END,
      city = CASE WHEN ${has("city")} THEN ${patch.city ?? null} ELSE city END,
      address_extra = CASE WHEN ${has("addressExtra")} THEN ${patch.addressExtra ?? null} ELSE address_extra END,
      customer_number = CASE WHEN ${has("customerNumber")} THEN ${patch.customerNumber ?? null} ELSE customer_number END,
      invoice_recipient = CASE WHEN ${has("invoiceRecipient")} THEN ${patch.invoiceRecipient ?? null} ELSE invoice_recipient END,
      notes = CASE WHEN ${has("notes")} THEN ${patch.notes ?? null} ELSE notes END,
      active = CASE WHEN ${has("active")} THEN ${patch.active ?? null} ELSE active END
    WHERE id = ${id}
    RETURNING id, kind, name, contact_name, email, phone, street, postal_code, city, address_extra, customer_number, invoice_recipient, notes, active
  `;
  return row ? toOrganization(row) : null;
}
