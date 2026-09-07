import { readFile } from "node:fs/promises";
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
  console.log("Database migration completed.");
} finally {
  await sql.end();
}
