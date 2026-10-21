import "server-only";
import { createAdminClient } from "../lib/supabase/admin";
import { indexLedgerEntry } from "./indexing.service";

/** How many stuck notes one invocation embeds. Keeps the request inside a normal serverless budget. */
const BATCH = 3;
/** Leaves a fresh `pending` row to the in-request indexer before this job claims it. */
const PENDING_GRACE_MS = 20_000;
/** Avoids re-embedding a poison file on every sweep. The manual retry action still sets the row back to pending. */
const FAILED_COOLDOWN_MS = 15 * 60_000;
/** A `processing` row older than this was claimed by a run that never finished. */
const STALE_PROCESSING_MS = 10 * 60_000;

export interface RetryStuckResult {
  attempted: number;
  indexed: number;
  failed: number;
  skipped: number;
  entryIds: string[];
}

interface IdRow {
  id: string;
}

/**
 * Re-embeds this owner's notes left in `pending` or `failed`, and reclaims `processing`
 * rows whose worker disappeared.
 *
 * `userId` must be the verified auth.uid() from the caller. The service-role client
 * bypasses row level security, so every statement filters `user_id` to that value.
 * Pending and failed reads match the partial index bitacora_ledger_embedding_status_idx.
 */
export async function retryStuckEmbeddings(userId: string): Promise<RetryStuckResult> {
  if (!userId) throw new Error("retry requires the authenticated user id");
  const db = createAdminClient();
  const now = Date.now();
  const grace = new Date(now - PENDING_GRACE_MS).toISOString();
  const failedBefore = new Date(now - FAILED_COOLDOWN_MS).toISOString();
  const staleBefore = new Date(now - STALE_PROCESSING_MS).toISOString();
  const ids: string[] = [];

  const { data: stale, error: staleError } = await db
    .from("bitacora_ledger_entries")
    .select("id")
    .eq("user_id", userId)
    .eq("embedding_status", "processing")
    .lt("updated_at", staleBefore)
    .order("updated_at", { ascending: true })
    .limit(BATCH);
  if (staleError) throw staleError;

  for (const row of (stale ?? []) as IdRow[]) {
    const { data: flipped, error: flipError } = await db
      .from("bitacora_ledger_entries")
      .update({ embedding_status: "pending" })
      .eq("id", row.id)
      .eq("user_id", userId)
      .eq("embedding_status", "processing")
      .select("id");
    if (flipError) throw flipError;
    if (flipped?.length) ids.push(row.id);
  }

  if (ids.length < BATCH) {
    const { data: pending, error: pendingError } = await db
      .from("bitacora_ledger_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("embedding_status", "pending")
      .lt("updated_at", grace)
      .order("updated_at", { ascending: true })
      .limit(BATCH - ids.length);
    if (pendingError) throw pendingError;
    for (const row of (pending ?? []) as IdRow[]) {
      if (!ids.includes(row.id)) ids.push(row.id);
    }
  }

  if (ids.length < BATCH) {
    const { data: failed, error: failedError } = await db
      .from("bitacora_ledger_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("embedding_status", "failed")
      .lt("updated_at", failedBefore)
      .order("updated_at", { ascending: true })
      .limit(BATCH - ids.length);
    if (failedError) throw failedError;
    for (const row of (failed ?? []) as IdRow[]) {
      if (!ids.includes(row.id)) ids.push(row.id);
    }
  }

  const result: RetryStuckResult = { attempted: ids.length, indexed: 0, failed: 0, skipped: 0, entryIds: ids };
  for (const entryId of ids) {
    try {
      const indexed = await indexLedgerEntry(userId, entryId);
      if (indexed.chunks === null) result.skipped += 1;
      else result.indexed += 1;
    } catch (e) {
      result.failed += 1;
      console.error("[indexing-retry] failed", entryId, e instanceof Error ? e.message : e);
    }
  }
  return result;
}
