"use server";

import { fail, ok, requireUser } from "../lib/actions/helpers";
import { retryStuckEmbeddings, type RetryStuckResult } from "../services/indexing-retry";
import type { ActionResponse } from "../types";

/**
 * Retries embeddings left pending or failed for the signed-in user, and reclaims
 * processing rows abandoned by a crashed run. The worker uses the service role
 * and filters every query with this user's id (auth.uid() from getUser()).
 */
export async function retryStuckIndexing(): Promise<ActionResponse<RetryStuckResult>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  try {
    return ok(await retryStuckEmbeddings(auth.userId));
  } catch (e) {
    console.error("[indexing-retry]", e instanceof Error ? e.message : e);
    return fail("indexing_retry_failed", "Could not retry indexing. Please try again.");
  }
}
