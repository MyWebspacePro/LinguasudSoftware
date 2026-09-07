import "server-only";

import postgres from "postgres";

let client: postgres.Sql | undefined;

export function db() {
  if (!client) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
    client = postgres(databaseUrl, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  }
  return client;
}
