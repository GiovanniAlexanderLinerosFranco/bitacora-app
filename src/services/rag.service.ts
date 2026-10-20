import "server-only";
import { embedTexts, generateJson } from "../lib/ai/openai";
import { RAG_RESPONSE_SCHEMA, buildSystemPrompt, buildUserPrompt, sanitizeSourceText } from "../lib/ai/prompts";
import { fail, fromPostgrest, ok, type ServerClient } from "../lib/actions/helpers";
import type { ActionResponse, RagAnswer, RagContext, RagQuery, RetrievedChunk, UserProfile } from "../types";
import { verifyAnswer, type RawCitation } from "./citation-verifier";

interface MatchRow {
  id: string;
  entry_id: string;
  subject_id: string | null;
  content: string;
  page_number: number | null;
  entry_title: string;
  entry_date: string;
  similarity: number;
}

interface ModelOutput {
  status: RagAnswer["status"];
  answer: string;
  citations: RawCitation[];
}

export type RagProfile = Pick<UserProfile, "role" | "academicLevel" | "careerOrField" | "preferredLanguage">;

const DEFAULT_THRESHOLD = 0.55;
const DEFAULT_MATCH_COUNT = 8;
/** Bounds prompt size (~6k tokens of sources). Lowest-similarity chunks are dropped first. */
const MAX_CONTEXT_CHARS = 24_000;

const NO_CONTEXT: Record<string, string> = {
  en: "I couldn't find this in your ledger, so I can't answer without guessing.",
  es: "No encontré esto en tu bitácora, así que no puedo responder sin adivinar.",
};
const insufficient = (lang: string, verification?: RagAnswer["verification"]): RagAnswer => ({
  status: "insufficient_context",
  answer: NO_CONTEXT[lang] ?? NO_CONTEXT.en,
  citations: [],
  verification,
});

/** Retrieval only: embeds the question and runs the user-scoped (RLS) similarity search. */
export async function retrieveChunks(supabase: ServerClient, query: RagQuery): Promise<ActionResponse<RetrievedChunk[]>> {
  const [embedding] = await embedTexts([query.question], "query");
  const { data, error } = await supabase.rpc("bitacora_match_document_embeddings", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: query.matchThreshold ?? DEFAULT_THRESHOLD,
    match_count: Math.min(query.matchCount ?? DEFAULT_MATCH_COUNT, 20),
    filter_subject: query.subjectId ?? null,
  });
  if (error) return fromPostgrest(error);

  let used = 0;
  const chunks: RetrievedChunk[] = [];
  for (const r of (data ?? []) as MatchRow[]) {
    const content = sanitizeSourceText(r.content);
    if (used + content.length > MAX_CONTEXT_CHARS && chunks.length > 0) break;
    used += content.length;
    chunks.push({
      sourceId: `S${chunks.length + 1}`,
      chunkId: r.id,
      entryId: r.entry_id,
      subjectId: r.subject_id,
      entryTitle: r.entry_title,
      entryDate: r.entry_date,
      pageNumber: r.page_number,
      content,
      similarity: r.similarity,
    });
  }
  return ok(chunks);
}

/** Full grounded-answer pipeline: retrieve -> (short-circuit) -> generate -> verify citations -> return. */
export async function answerQuestion(
  supabase: ServerClient,
  query: RagQuery,
  profile: RagProfile,
): Promise<ActionResponse<RagAnswer>> {
  const question = query.question.trim();
  if (!question || question.length > 2000) {
    return fail("validation_error", "Invalid input.", { question: "Question must be 1-2000 characters." });
  }
  const lang = profile.preferredLanguage;

  try {
    const retrieved = await retrieveChunks(supabase, { ...query, question });
    if (retrieved.error) return retrieved;
    const chunks = retrieved.data;

    // Hard guarantee: no matching context means the generation model is never called.
    if (chunks.length === 0) return ok(insufficient(lang));

    const ctx: RagContext = {
      query: { ...query, question },
      user: { role: profile.role, academicLevel: profile.academicLevel, careerOrField: profile.careerOrField, language: lang },
      chunks,
    };
    const raw = await generateJson<ModelOutput>({
      system: buildSystemPrompt(ctx),
      prompt: buildUserPrompt(ctx),
      schema: RAG_RESPONSE_SCHEMA,
      schemaName: "grounded_answer",
    });

    if (raw.status !== "answered" || !raw.answer?.trim()) return ok(insufficient(lang));

    const v = verifyAnswer(raw.answer, Array.isArray(raw.citations) ? raw.citations : [], chunks);
    const verification = { removedSentences: v.removedSentences, removedMarkers: v.removedMarkers, rejectedCitations: v.rejectedCitations };
    if (!v.answer || v.citations.length === 0) return ok(insufficient(lang, verification));

    return ok({ status: "answered", answer: v.answer, citations: v.citations, verification });
  } catch (e) {
    console.error("[rag]", e instanceof Error ? e.message : e);
    return fail("rag_failed", "The assistant could not answer right now. Please try again.");
  }
}
