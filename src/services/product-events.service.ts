import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isProductEventName, sanitizeEventMetadata, type ProductEventName } from "../lib/product-events";

/**
 * Inserts one personal-layer funnel mark for `userId`.
 * Callers must pass the verified owner. The service-role client bypasses row level security,
 * so the row's user_id is that argument and nothing else is read.
 * Metadata is reduced to short codes. Note text, questions and file names are dropped.
 * A repeated first-time event hits the unique index and is ignored.
 */
export async function recordOwnedProductEvent(
  db: SupabaseClient,
  userId: string,
  eventName: ProductEventName,
  metadata?: unknown,
): Promise<void> {
  if (!userId || !isProductEventName(eventName)) return;
  const safe = sanitizeEventMetadata(metadata);
  const { error } = await db.from("bitacora_product_events").insert({
    user_id: userId,
    event_name: eventName,
    metadata: safe,
  });
  if (error && error.code !== "23505") console.error("[telemetry]", error.code);
}
