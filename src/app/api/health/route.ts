import { NextResponse } from "next/server";

import { db } from "@/lib/database";

/**
 * Readiness endpoint for Coolify and other deployment checks.
 * A successful HTTP response means that this application can reach PostgreSQL.
 */
export async function GET() {
  try {
    await db()`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
