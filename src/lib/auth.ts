import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

import { db } from "@/lib/database";
import { verifyPassword } from "@/lib/passwords";

const SESSION_COOKIE = "linguasud_session";
const SESSION_DAYS = 14;

type Role = "office" | "teacher" | "participant";
type SessionUser = { id: string; email: string; name: string; role: Role; active: boolean };
type SessionUserWithHash = SessionUser & { password_hash: string };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function signIn(email: string, password: string) {
  const sql = db();
  const [user] = await sql<SessionUserWithHash[]>`
    SELECT id, email, name, role, active, password_hash FROM users WHERE email = ${email.toLowerCase()} AND active = true
  `;
  if (!user || !verifyPassword(password, user.password_hash)) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await sql`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (${randomUUID()}, ${user.id}, ${hashToken(token)}, ${expiresAt})`;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: expiresAt, path: "/" });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sql = db();
  const [user] = await sql<SessionUser[]>`
    SELECT users.id, users.email, users.name, users.role, users.active
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${hashToken(token)} AND sessions.expires_at > now() AND users.active = true
  `;
  return user ?? null;
}

export async function signOut() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db()`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`;
  store.delete(SESSION_COOKIE);
}

export async function requireRole(...roles: Role[]) {
  const user = await currentUser();
  if (!user || !roles.includes(user.role)) throw new Error("UNAUTHORIZED");
  return user;
}
