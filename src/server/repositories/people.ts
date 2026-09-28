import "server-only";

import { isRole, type Role } from "@/lib/roles";
import type { Person, Salutation } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  email: string;
  salutation: Salutation | null;
  first_name: string;
  last_name: string;
  phone1: string | null;
  phone2: string | null;
  whatsapp_ok: boolean;
  signal_ok: boolean;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  address_extra: string | null;
  active: boolean;
  roles: string[];
};

const toPerson = (row: Row): Person => ({
  id: row.id,
  email: row.email,
  salutation: row.salutation,
  firstName: row.first_name,
  lastName: row.last_name,
  phone1: row.phone1,
  phone2: row.phone2,
  whatsappOk: row.whatsapp_ok,
  signalOk: row.signal_ok,
  street: row.street,
  postalCode: row.postal_code,
  city: row.city,
  addressExtra: row.address_extra,
  active: row.active,
  roles: row.roles.filter(isRole),
});

export type PersonListFilter = {
  role?: Role;
  includeInactive?: boolean;
  search?: string;
};

export async function listPeople(sql: Sql, filter: PersonListFilter = {}): Promise<Person[]> {
  const includeInactive = filter.includeInactive === true;
  const search = filter.search?.trim() ?? "";
  const like = `%${search.toLowerCase()}%`;
  const rows = await sql<Row[]>`
    SELECT users.id, users.email, users.salutation, users.first_name, users.last_name, users.phone1, users.phone2,
           users.whatsapp_ok, users.signal_ok, users.street, users.postal_code, users.city, users.address_extra, users.active,
           COALESCE(array_agg(user_roles.role) FILTER (WHERE user_roles.role IS NOT NULL), '{}') AS roles
    FROM users
    LEFT JOIN user_roles ON user_roles.user_id = users.id
    WHERE (users.active = true OR ${includeInactive})
      AND (${search} = '' OR lower(users.first_name) LIKE ${like} OR lower(users.last_name) LIKE ${like} OR lower(users.email) LIKE ${like})
      AND (${filter.role ?? null}::text IS NULL OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = users.id AND ur.role = ${filter.role ?? null}))
    GROUP BY users.id
    ORDER BY users.last_name, users.first_name
  `;
  return rows.map(toPerson);
}

export async function getPerson(sql: Sql, id: string): Promise<Person | null> {
  const [row] = await sql<Row[]>`
    SELECT users.id, users.email, users.salutation, users.first_name, users.last_name, users.phone1, users.phone2,
           users.whatsapp_ok, users.signal_ok, users.street, users.postal_code, users.city, users.address_extra, users.active,
           COALESCE(array_agg(user_roles.role) FILTER (WHERE user_roles.role IS NOT NULL), '{}') AS roles
    FROM users
    LEFT JOIN user_roles ON user_roles.user_id = users.id
    WHERE users.id = ${id}
    GROUP BY users.id
  `;
  return row ? toPerson(row) : null;
}

export type PersonInput = {
  email: string;
  passwordHash: string;
  salutation: Salutation | null;
  firstName: string;
  lastName: string;
  phone1: string | null;
  phone2: string | null;
  whatsappOk: boolean;
  signalOk: boolean;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  addressExtra: string | null;
};

export async function insertPerson(sql: Sql, input: PersonInput): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO users (email, password_hash, salutation, first_name, last_name, phone1, phone2, whatsapp_ok, signal_ok, street, postal_code, city, address_extra)
    VALUES (
      ${input.email}, ${input.passwordHash}, ${input.salutation}, ${input.firstName}, ${input.lastName},
      ${input.phone1}, ${input.phone2}, ${input.whatsappOk}, ${input.signalOk},
      ${input.street}, ${input.postalCode}, ${input.city}, ${input.addressExtra}
    )
    RETURNING id
  `;
  return row.id;
}

export type PersonPatch = Partial<Omit<PersonInput, "passwordHash">> & { active?: boolean };

export async function updatePerson(sql: Sql, id: string, patch: PersonPatch): Promise<void> {
  const has = (key: keyof PersonPatch) => Object.prototype.hasOwnProperty.call(patch, key);
  await sql`
    UPDATE users SET
      email = CASE WHEN ${has("email")} THEN ${patch.email ?? null} ELSE email END,
      salutation = CASE WHEN ${has("salutation")} THEN ${patch.salutation ?? null} ELSE salutation END,
      first_name = CASE WHEN ${has("firstName")} THEN ${patch.firstName ?? null} ELSE first_name END,
      last_name = CASE WHEN ${has("lastName")} THEN ${patch.lastName ?? null} ELSE last_name END,
      phone1 = CASE WHEN ${has("phone1")} THEN ${patch.phone1 ?? null} ELSE phone1 END,
      phone2 = CASE WHEN ${has("phone2")} THEN ${patch.phone2 ?? null} ELSE phone2 END,
      whatsapp_ok = CASE WHEN ${has("whatsappOk")} THEN ${patch.whatsappOk ?? null} ELSE whatsapp_ok END,
      signal_ok = CASE WHEN ${has("signalOk")} THEN ${patch.signalOk ?? null} ELSE signal_ok END,
      street = CASE WHEN ${has("street")} THEN ${patch.street ?? null} ELSE street END,
      postal_code = CASE WHEN ${has("postalCode")} THEN ${patch.postalCode ?? null} ELSE postal_code END,
      city = CASE WHEN ${has("city")} THEN ${patch.city ?? null} ELSE city END,
      address_extra = CASE WHEN ${has("addressExtra")} THEN ${patch.addressExtra ?? null} ELSE address_extra END,
      active = CASE WHEN ${has("active")} THEN ${patch.active ?? null} ELSE active END
    WHERE id = ${id}
  `;
}

export async function setPasswordHash(sql: Sql, id: string, passwordHash: string): Promise<void> {
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${id}`;
}

export async function getPasswordHash(sql: Sql, id: string): Promise<string | null> {
  const [row] = await sql<{ password_hash: string }[]>`SELECT password_hash FROM users WHERE id = ${id}`;
  return row?.password_hash ?? null;
}

export async function replaceRoles(sql: Sql, userId: string, roles: Role[]): Promise<void> {
  await sql`DELETE FROM user_roles WHERE user_id = ${userId}`;
  for (const role of roles) {
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${userId}, ${role})`;
  }
}

export async function listRoles(sql: Sql, userId: string): Promise<Role[]> {
  const rows = await sql<{ role: Role }[]>`SELECT role FROM user_roles WHERE user_id = ${userId}`;
  return rows.map((row) => row.role);
}

export async function deleteSessions(sql: Sql, userId: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`;
}
