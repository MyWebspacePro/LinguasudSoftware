import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { ORGANIZATION_KINDS, type Organization } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import * as repo from "@/server/repositories/organizations";

const nullableText = (max: number) => z.string().trim().max(max).nullish();

export const organizationCreateSchema = z.object({
  kind: z.enum(ORGANIZATION_KINDS),
  name: z.string().trim().min(1).max(200),
  contactName: nullableText(200),
  email: z.email().nullish(),
  phone: nullableText(60),
  street: nullableText(200),
  postalCode: nullableText(20),
  city: nullableText(120),
  addressExtra: nullableText(200),
  customerNumber: nullableText(60),
  invoiceRecipient: nullableText(200),
  notes: nullableText(4000),
});

export const organizationUpdateSchema = z
  .object({
    kind: z.enum(ORGANIZATION_KINDS).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    contactName: nullableText(200),
    email: z.email().nullish(),
    phone: nullableText(60),
    street: nullableText(200),
    postalCode: nullableText(20),
    city: nullableText(120),
    addressExtra: nullableText(200),
    customerNumber: nullableText(60),
    invoiceRecipient: nullableText(200),
    notes: nullableText(4000),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

type CreateData = z.infer<typeof organizationCreateSchema>;

function toInput(data: CreateData): repo.OrganizationInput {
  return {
    kind: data.kind,
    name: data.name,
    contactName: data.contactName ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    street: data.street ?? null,
    postalCode: data.postalCode ?? null,
    city: data.city ?? null,
    addressExtra: data.addressExtra ?? null,
    customerNumber: data.customerNumber ?? null,
    invoiceRecipient: data.invoiceRecipient ?? null,
    notes: data.notes ?? null,
  };
}

export function listOrganizations(filter: repo.OrganizationListFilter): Promise<Organization[]> {
  return repo.listOrganizations(db(), filter);
}

export function getOrganization(id: string): Promise<Organization | null> {
  return repo.getOrganization(db(), id);
}

export async function createOrganization(actor: SessionUser, data: CreateData): Promise<Organization> {
  return db().begin(async (tx) => {
    const organization = await repo.insertOrganization(tx, toInput(data));
    await recordChange(tx, {
      entityType: "organization",
      entityId: organization.id,
      eventType: "created",
      summary: `Kostenträger «${organization.name}» angelegt`,
      after: organization,
      actorId: actor.id,
    });
    return organization;
  });
}

export async function updateOrganization(
  actor: SessionUser,
  id: string,
  patch: repo.OrganizationPatch,
): Promise<Organization> {
  return db().begin(async (tx) => {
    const before = await repo.getOrganization(tx, id);
    if (!before) throw notFound("Kostenträger wurde nicht gefunden.");
    const organization = await repo.updateOrganization(tx, id, patch);
    if (!organization) throw notFound("Kostenträger wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "organization",
      entityId: id,
      eventType: "updated",
      summary: `Kostenträger «${organization.name}» geändert`,
      before,
      after: organization,
      actorId: actor.id,
    });
    return organization;
  });
}
