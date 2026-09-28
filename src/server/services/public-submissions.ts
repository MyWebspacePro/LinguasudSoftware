import "server-only";

import { createHash } from "node:crypto";

import type { Sql } from "@/server/db";
import { HttpError } from "@/server/http";

/** A short, transactional throttle shared by the enquiry and placement forms. */
export async function recordPublicSubmission(sql: Sql, formType: "inquiry" | "placement", email: string, ip: string | null) {
  const hashes = [email.trim().toLowerCase()].map((value) => createHash("sha256").update(`email:${value}`).digest("hex"));
  if (ip) hashes.push(createHash("sha256").update(`ip:${ip}`).digest("hex"));

  // Serialize simultaneous submissions for the same email on all app instances.
  await sql`SELECT pg_advisory_xact_lock(hashtext(${hashes[0]}))`;
  await sql`DELETE FROM public_submissions WHERE created_at < now() - interval '2 days'`;
  for (const [index, hash] of hashes.entries()) {
    const [row] = await sql<{ attempts: number }[]>`
      SELECT count(*)::int AS attempts FROM public_submissions
      WHERE form_type = ${formType} AND visitor_hash = ${hash}
        AND created_at > now() - interval '1 hour'
    `;
    if (row.attempts >= (index === 0 ? 5 : 20)) throw new HttpError(429, "Zu viele Anfragen. Bitte später erneut versuchen.");
  }
  for (const hash of hashes) {
    await sql`INSERT INTO public_submissions (form_type, visitor_hash) VALUES (${formType}, ${hash})`;
  }
}
