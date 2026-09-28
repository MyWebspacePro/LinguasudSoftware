import "server-only";

import { serverEnv } from "@/lib/env";
import { db } from "@/server/db";
import * as repo from "@/server/repositories/notifications";

function mailEnv() {
  try {
    return serverEnv();
  } catch {
    return null;
  }
}

export function isMailConfigured(): boolean {
  const env = mailEnv();
  return Boolean(env?.MAIL_PROVIDER && (env.MAIL_API_KEY || env.MAIL_SMTP_URL));
}

async function sendViaProvider(to: string, subject: string, body: string): Promise<void> {
  const env = mailEnv();
  if (!env?.MAIL_PROVIDER || !env.MAIL_API_KEY) throw new Error("Mail provider is not configured.");
  const from = env.MAIL_FROM ?? "sprachkurse@linguasud.com";

  if (env.MAIL_PROVIDER === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.MAIL_API_KEY}` },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
    if (!response.ok) throw new Error(`Resend error ${response.status}`);
    return;
  }

  throw new Error(`Mail provider ${env.MAIL_PROVIDER} is not implemented yet.`);
}

/**
 * Process the outbound queue. The application runs fully without mail
 * configured; in that case this is a no-op.
 */
export async function processMailQueue(limit = 20): Promise<{ processed: number; failed: number; skipped: boolean }> {
  if (!isMailConfigured()) return { processed: 0, failed: 0, skipped: true };
  const sql = db();
  const messages = await repo.listQueuedMessages(sql, limit);
  let processed = 0;
  let failed = 0;
  for (const message of messages) {
    try {
      await sendViaProvider(message.toEmail, message.subject, message.body);
      await repo.markMessageSent(sql, message.id);
      processed += 1;
    } catch (error) {
      await repo.markMessageFailed(sql, message.id, error instanceof Error ? error.message : "unknown error");
      failed += 1;
    }
  }
  return { processed, failed, skipped: false };
}
