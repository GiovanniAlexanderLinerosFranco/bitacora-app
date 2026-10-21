"use server";

import { fail, fromPostgrest, parse, requireUser } from "../lib/actions/helpers";
import { askAssistantSchema } from "../lib/actions/schemas";
import { toProfile, type ProfileRow } from "../lib/actions/mappers";
import { consumeFreeQuestion } from "../lib/quotas";
import { answerQuestion } from "../services/rag.service";
import { recordOwnedProductEvent } from "../services/product-events.service";
import type { ActionResponse, RagAnswer } from "../types";

/**
 * Asks the grounded tutor. Without a team id the answer comes from the caller's own ledger.
 * With a team id it comes only from chunks copied into that team.
 */
export async function askAssistant(input: {
  question: string;
  subjectId?: string | null;
  teamId?: string | null;
}): Promise<ActionResponse<RagAnswer>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const parsed = parse(askAssistantSchema, input);
  if (parsed.error) return { data: null, error: parsed.error };

  const { data: row, error } = await auth.supabase.from("bitacora_profiles").select("*").eq("id", auth.userId).maybeSingle();
  if (error) return fromPostgrest(error);
  if (!row) return fail("not_found", "Profile not found.");

  const overQuota = await consumeFreeQuestion(auth.supabase, auth.userId);
  if (overQuota) return overQuota;

  const result = await answerQuestion(
    auth.supabase,
    {
      question: parsed.value.question,
      subjectId: parsed.value.subjectId ?? null,
      teamId: parsed.value.teamId ?? null,
    },
    toProfile(row as ProfileRow),
  );
  if (!result.error) {
    await recordOwnedProductEvent(auth.supabase, auth.userId, "first_query_asked", {
      has_subject: Boolean(parsed.value.subjectId),
      has_team: Boolean(parsed.value.teamId),
    });
    if (result.data.status === "insufficient_context") {
      await recordOwnedProductEvent(auth.supabase, auth.userId, "citation_miss", {
        reason: result.data.verification ? "unverified" : "no_chunks",
      });
    }
  }
  return result;
}
