import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { db } from "@/lib/database";
import { verifyPassword } from "@/lib/passwords";
import { isLoginRateLimited } from "@/lib/rate-limit";
import { primaryRole, type Role } from "@/lib/roles";
import { logSecurityEvent } from "@/lib/security-events";

const SESSION_COOKIE = "linguasud_session";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  roles: Role[];
  /** @deprecated Prefer `roles`/`hasRole`. Kept while modules are migrated. */
  role: Role;
};

export type AuthContext = {
  ip?: string | null;
  userAgent?: string | null;
};

type SessionRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  active: boolean;
  roles: Role[];
};

export class AuthError extends Error {
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "RATE_LIMITED";

  constructor(code: "UNAUTHENTICATED" | "FORBIDDEN" | "RATE_LIMITED") {
    super(code);
    this.name = "AuthError";
    this.code = code;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toSessionUser(row: Pick<SessionRow, "id" | "email" | "first_name" | "last_name">, roles: Role[]): SessionUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    roles,
    role: primaryRole(roles),
  };
}

export async function signIn(email: string, password: string, context: AuthContext = {}): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const sql = db();

  if (await isLoginRateLimited(normalizedEmail, context.ip ?? null)) {
    await logSecurityEvent({ type: "login_blocked", email: normalizedEmail, ip: context.ip, userAgent: context.userAgent });
    throw new AuthError("RATE_LIMITED");
  }

  const [user] = await sql<SessionRow[]>`
    SELECT id, email, first_name, last_name, password_hash, active, '{}'::text[] AS roles
    FROM users
    WHERE email = ${normalizedEmail}
  `;

  const passwordValid = user ? verifyPassword(password, user.password_hash) : false;
  if (!user || !user.active || !passwordValid) {
    await logSecurityEvent({
      type: "login_failed",
      userId: user?.id ?? null,
      email: normalizedEmail,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return null;
  }

  const roleRows = await sql<{ role: Role }[]>`SELECT role FROM user_roles WHERE user_id = ${user.id}`;
  const roles = roleRows.map((row) => row.role);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent, ip)
    VALUES (${randomUUID()}, ${user.id}, ${hashToken(token)}, ${expiresAt}, ${context.userAgent ?? null}, ${context.ip ?? null})
  `;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  await logSecurityEvent({ type: "login_succeeded", userId: user.id, email: user.email, ip: context.ip, userAgent: context.userAgent });

  return toSessionUser(user, roles);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db()<SessionRow[]>`
    SELECT users.id, users.email, users.first_name, users.last_name, users.password_hash, users.active,
           COALESCE(array_agg(user_roles.role) FILTER (WHERE user_roles.role IS NOT NULL), '{}') AS roles
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    LEFT JOIN user_roles ON user_roles.user_id = users.id
    WHERE sessions.token_hash = ${hashToken(token)}
      AND sessions.expires_at > now()
      AND users.active = true
    GROUP BY users.id
  `;

  return row ? toSessionUser(row, row.roles) : null;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db()`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
    await logSecurityEvent({ type: "logout" });
  }
  store.delete(SESSION_COOKIE);
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  if (roles.length > 0 && !roles.some((role) => user.roles.includes(role))) throw new AuthError("FORBIDDEN");
  return user;
}

/** Invalidate every session of a user (on deactivation or password change). */
export async function revokeUserSessions(userId: string): Promise<void> {
  await db()`DELETE FROM sessions WHERE user_id = ${userId}`;
  await logSecurityEvent({ type: "sessions_revoked", userId });
}
