import "server-only";

import { db } from "@/lib/database";

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 8;

/**
 * Simple database-backed brute-force guard for the login endpoint.
 * Counts recent failed attempts per email or IP within a sliding window.
 */
export async function isLoginRateLimited(email: string, ip: string | null): Promise<boolean> {
  const [row] = await db()<{ failures: number }[]>`
    SELECT count(*)::int AS failures
    FROM security_events
    WHERE event_type = 'login_failed'
      AND occurred_at > now() - (${WINDOW_MINUTES} * interval '1 minute')
      AND (email = ${email} OR (${ip ?? null}::text IS NOT NULL AND ip = ${ip ?? null}))
  `;
  return (row?.failures ?? 0) >= MAX_FAILURES;
}
