import { readdir, readFile } from "node:fs/promises";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for database migrations.");
}

const MIGRATION_LOCK_KEY = 728311;

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  // Serialize migrations across concurrently starting replicas.
  await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`;

  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

  const migrationDirectory = new URL("../database/migrations/", import.meta.url);
  const migrationNames = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of migrationNames) {
    const [applied] = await sql`SELECT name FROM schema_migrations WHERE name = ${name}`;
    if (applied) continue;
    const migration = await readFile(new URL(`../database/migrations/${name}`, import.meta.url), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration);
      await transaction`INSERT INTO schema_migrations (name) VALUES (${name})`;
    });
    console.log(`Applied ${name}.`);
  }

  const [officeAccount] = await sql`
    SELECT users.id
    FROM users
    JOIN user_roles ON user_roles.user_id = users.id
    WHERE user_roles.role IN ('office', 'admin')
    LIMIT 1
  `;

  if (!officeAccount) {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) {
      throw new Error(
        "BOOTSTRAP_ADMIN_EMAIL and a password with at least 12 characters are required for an empty database.",
      );
    }
    const salt = randomBytes(16).toString("hex");
    const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    const userId = randomUUID();
    await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO users (id, email, password_hash, salutation, first_name, last_name, active)
        VALUES (${userId}, ${email}, ${passwordHash}, 'divers', 'Büro', 'Administration', true)
      `;
      await transaction`INSERT INTO user_roles (user_id, role) VALUES (${userId}, 'office')`;
      await transaction`INSERT INTO user_roles (user_id, role) VALUES (${userId}, 'admin')`;
    });
    console.log("Initial office/admin account created.");
  }

  console.log("Database migrations completed.");
} finally {
  try {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
  } catch {
    // connection may already be gone; nothing to release
  }
  await sql.end();
}
