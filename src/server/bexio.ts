import "server-only";

import { serverEnv } from "@/lib/env";
import type { Invoice } from "@/lib/types";

function bexioEnv() {
  try {
    return serverEnv();
  } catch {
    return null;
  }
}

export function isBexioConfigured(): boolean {
  const env = bexioEnv();
  return Boolean(env?.BEXIO_API_TOKEN);
}

export type BexioSyncResult = { synced: boolean; bexioId?: string; reason?: string };

/**
 * Push an invoice to bexio. Real deployments implement OAuth2 + POST /2.0/kb_invoice
 * here; without configuration the invoice stays local and can be synced later.
 */
export async function pushInvoiceToBexio(invoice: Invoice): Promise<BexioSyncResult> {
  const env = bexioEnv();
  // Real integration: build kb_invoice payload from invoice line items.
  void invoice;
  if (!env?.BEXIO_API_TOKEN) return { synced: false, reason: "bexio_nicht_konfiguriert" };
  return { synced: false, reason: "bexio_sync_noch_nicht_implementiert" };
}
