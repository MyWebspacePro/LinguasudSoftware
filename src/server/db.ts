import "server-only";

import type postgres from "postgres";

import { db } from "@/lib/database";

/** A queryable handle: either the pool or an open transaction. */
export type Sql = postgres.Sql | postgres.TransactionSql;

export { db };
