"use server";

import { z } from "zod";
import { fail, fromPostgrest, parse, requireUser } from "../lib/actions/helpers";
import { toProfile, type ProfileRow } from "../lib/actions/mappers";
import { answerQuestion } from "../services/rag.service";
import type { ActionResponse, RagAnswer } from "../types";

const askSchema = z
  .object({
    question: z.string().trim().min(1, "Required").max(2000),
    subjectId: z.string().uuid().nullable().optional(),
  })
  .strict();

/** Ask the grounded tutor/consultant. Answers come only from the caller's own ledger, with verified citations. */
export async function askAssistant(input: { question: string; subjectId?: string | null }): Promise<ActionResponse<RagAnswer>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const parsed = parse(askSchema, input);
  if (parsed.error) return { data: null, error: parsed.error };

  const { data: row, error } = await auth.supabase.from("bitacora_profiles").select("*").eq("id", auth.userId).maybeSingle();
  if (error) return fromPostgrest(error);
  if (!row) return fail("not_found", "Profile not found.");

  return answerQuestion(
    auth.supabase,
    { question: parsed.value.question, subjectId: parsed.value.subjectId ?? null },
    toProfile(row as ProfileRow),
  );
}
