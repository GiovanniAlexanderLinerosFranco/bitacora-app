import "server-only";
import { fail, fromPostgrest, type ServerClient } from "./actions/helpers";
import { grantsProAccess } from "./billing";
import {
  FREE_ATTACHMENT_LIMIT,
  FREE_LEDGER_ENTRY_LIMIT,
  FREE_QUESTION_RATE_LIMIT,
  FREE_QUESTION_RATE_WINDOW_SECONDS,
  FREE_QUESTIONS_PER_MONTH,
  PRO_QUESTIONS_PER_MONTH,
} from "./plan-limits";
import type { ActionResponse } from "../types";

/** Active Pro skips the free ceilings, whether the payment was Stripe or Wompi. A missing row keeps the free limits. */
async function isActiveProPlan(supabase: ServerClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("bitacora_subscriptions")
    .select("plan_type, subscription_status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[billing]", error.code);
    return false;
  }
  return grantsProAccess(
    data.plan_type as string,
    data.subscription_status as string,
    (data.current_period_end as string | null) ?? null,
  );
}

/** Blocks a new personal note once the free plan already holds 50 entries. */
export async function assertFreeEntryQuota(supabase: ServerClient, userId: string): Promise<ActionResponse<never> | null> {
  if (await isActiveProPlan(supabase, userId)) return null;
  const { count, error } = await supabase
    .from("bitacora_ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return fromPostgrest(error);
  if ((count ?? 0) >= FREE_LEDGER_ENTRY_LIMIT) {
    return fail(
      "entry_quota_exceeded",
      `Free plan limit reached: ${FREE_LEDGER_ENTRY_LIMIT} ledger entries. Delete a note to add another.`,
    );
  }
  return null;
}

/** Blocks a new attachment once the free plan already has 5 files. Replacing an existing file does not call this. */
export async function assertFreeAttachmentQuota(supabase: ServerClient, userId: string): Promise<ActionResponse<never> | null> {
  if (await isActiveProPlan(supabase, userId)) return null;
  const { count, error } = await supabase
    .from("bitacora_ledger_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("source_file_path", "is", null);
  if (error) return fromPostgrest(error);
  if ((count ?? 0) >= FREE_ATTACHMENT_LIMIT) {
    return fail(
      "attachment_quota_exceeded",
      `Free plan limit reached: ${FREE_ATTACHMENT_LIMIT} attachments. Remove a file to upload another.`,
    );
  }
  return null;
}

/**
 * Reserves one tutor question for auth.uid() inside bitacora_consume_assistant_request.
 * Free accounts stop at 30 questions per UTC month. Active Pro uses a high ceiling instead.
 * The short burst limit still applies, so one account cannot flood the model.
 */
export async function consumeFreeQuestion(supabase: ServerClient, userId: string): Promise<ActionResponse<never> | null> {
  const pro = await isActiveProPlan(supabase, userId);
  const { data, error } = await supabase.rpc("bitacora_consume_assistant_request", {
    p_monthly_limit: pro ? PRO_QUESTIONS_PER_MONTH : FREE_QUESTIONS_PER_MONTH,
    p_rate_limit: FREE_QUESTION_RATE_LIMIT,
    p_window_seconds: FREE_QUESTION_RATE_WINDOW_SECONDS,
  });
  if (error) return fromPostgrest(error);
  if (data === "monthly_quota") {
    return fail(
      "question_quota_exceeded",
      `Free plan limit reached: ${FREE_QUESTIONS_PER_MONTH} tutor questions this month.`,
    );
  }
  if (data === "rate_limited") {
    return fail(
      "rate_limited",
      `Too many questions (${FREE_QUESTION_RATE_LIMIT} per ${FREE_QUESTION_RATE_WINDOW_SECONDS} seconds). Wait a moment and try again.`,
    );
  }
  if (data !== "ok") return fail("db_error", "The operation could not be completed.");
  return null;
}
