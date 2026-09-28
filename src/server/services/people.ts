import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { hashPassword } from "@/lib/passwords";
import { ROLES, type Role } from "@/lib/roles";
import { logSecurityEvent } from "@/lib/security-events";
import { SALUTATIONS, type Person } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import type { Sql } from "@/server/db";
import { conflict, notFound } from "@/server/http";
import * as repo from "@/server/repositories/people";

const nullableText = (max: number) => z.string().trim().max(max).nullish();

const personFields = {
  email: z.email().transform((value) => value.trim().toLowerCase()),
  salutation: z.enum(SALUTATIONS).nullish(),
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  phone1: nullableText(40),
  phone2: nullableText(40),
  whatsappOk: z.boolean().optional(),
  signalOk: z.boolean().optional(),
  street: nullableText(200),
  postalCode: nullableText(20),
  city: nullableText(120),
  addressExtra: nullableText(200),
};

export const personCreateSchema = z.object({
  ...personFields,
  password: z.string().min(12).max(256),
  roles: z.array(z.enum(ROLES)).min(1),
});

export const personUpdateSchema = z
  .object({
    ...personFields,
    password: z.string().min(12).max(256).optional(),
    roles: z.array(z.enum(ROLES)).min(1).optional(),
    active: z.boolean().optional(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

type CreateData = z.infer<typeof personCreateSchema>;

function slugPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

async function generateTeacherCode(tx: Sql, firstName: string, lastName: string): Promise<string> {
  const base = `${slugPart(firstName)}${slugPart(lastName)}` || "LEHR";
  const rows = await tx<{ code: string }[]>`SELECT code FROM teacher_profiles WHERE code LIKE ${`${base}%`}`;
  const used = new Set(rows.map((row) => row.code));
  for (let index = 1; index <= 99; index += 1) {
    const code = `${base}${String(index).padStart(2, "0")}`;
    if (!used.has(code)) return code;
  }
  throw conflict("Für diesen Namen konnte kein eindeutiges Lehrpersonen-Kürzel erzeugt werden.");
}

async function ensureProfiles(tx: Sql, userId: string, roles: Role[], firstName: string, lastName: string): Promise<void> {
  if (roles.includes("teacher")) {
    const code = await generateTeacherCode(tx, firstName, lastName);
    await tx`
      INSERT INTO teacher_profiles (user_id, code)
      VALUES (${userId}, ${code})
      ON CONFLICT (user_id) DO NOTHING
    `;
  }
  if (roles.includes("participant")) {
    await tx`
      INSERT INTO participant_profiles (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `;
  }
}

export function listPeople(filter: repo.PersonListFilter): Promise<Person[]> {
  return repo.listPeople(db(), filter);
}

export function getPerson(id: string): Promise<Person | null> {
  return repo.getPerson(db(), id);
}

export async function createPerson(actor: SessionUser, data: CreateData): Promise<Person> {
  return db().begin(async (tx) => {
    const id = await repo.insertPerson(tx, {
      email: data.email,
      passwordHash: hashPassword(data.password),
      salutation: data.salutation ?? null,
      firstName: data.firstName,
      lastName: data.lastName,
      phone1: data.phone1 ?? null,
      phone2: data.phone2 ?? null,
      whatsappOk: data.whatsappOk ?? false,
      signalOk: data.signalOk ?? false,
      street: data.street ?? null,
      postalCode: data.postalCode ?? null,
      city: data.city ?? null,
      addressExtra: data.addressExtra ?? null,
    });
    await repo.replaceRoles(tx, id, data.roles);
    await ensureProfiles(tx, id, data.roles, data.firstName, data.lastName);
    const person = await repo.getPerson(tx, id);
    if (!person) throw notFound("Person konnte nicht angelegt werden.");
    await recordChange(tx, {
      entityType: "person",
      entityId: id,
      eventType: "created",
      summary: `Person «${person.firstName} ${person.lastName}» angelegt`,
      after: person,
      actorId: actor.id,
    });
    return person;
  });
}

export type PersonUpdateData = z.infer<typeof personUpdateSchema>;

export async function updatePerson(actor: SessionUser, id: string, data: PersonUpdateData): Promise<Person> {
  const { password, roles, ...fields } = data;
  return db().begin(async (tx) => {
    const before = await repo.getPerson(tx, id);
    if (!before) throw notFound("Person wurde nicht gefunden.");

    await repo.updatePerson(tx, id, fields);
    if (roles) {
      await repo.replaceRoles(tx, id, roles);
      await ensureProfiles(tx, id, roles, before.firstName, before.lastName);
    }
    if (password) {
      await repo.setPasswordHash(tx, id, hashPassword(password));
      await repo.deleteSessions(tx, id);
    }
    if (fields.active === false) {
      await repo.deleteSessions(tx, id);
    }

    const person = await repo.getPerson(tx, id);
    if (!person) throw notFound("Person wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "person",
      entityId: id,
      eventType: "updated",
      summary: `Person «${person.firstName} ${person.lastName}» geändert`,
      before,
      after: person,
      actorId: actor.id,
    });
    return person;
  }).then(async (person) => {
    if (password) await logSecurityEvent({ type: "password_changed", userId: id, email: person.email });
    if (fields.active === false) await logSecurityEvent({ type: "account_deactivated", userId: id, email: person.email });
    return person;
  });
}
