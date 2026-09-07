import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for database migrations.");
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const migration = await readFile(new URL("../database/migrations/001_initial.sql", import.meta.url), "utf8");

try {
  await sql.begin(async (transaction) => {
    await transaction.unsafe(migration);
  });
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL and a password with at least 12 characters are required.");
  }
  const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (!existing) {
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    await sql`INSERT INTO users (id, email, name, role, password_hash) VALUES (${randomUUID()}, ${email}, 'Büro', 'office', ${passwordHash})`;
    console.log("Initial office account created.");
  }
  console.log("Database migration completed.");
} finally {
  await sql.end();
}
