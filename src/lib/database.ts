import "server-only";

import postgres from "postgres";

import { serverEnv } from "@/lib/env";

let client: postgres.Sql | undefined;

export function db() {
  if (!client) {
    client = postgres(serverEnv().DATABASE_URL, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  }
  return client;
}
