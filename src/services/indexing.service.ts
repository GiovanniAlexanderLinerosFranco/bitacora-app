import "server-only";
import { createAdminClient } from "../lib/supabase/admin";
import { downloadAttachmentForUser } from "../lib/supabase/storage";
import { embedTexts } from "../lib/ai/openai";
import { recordOwnedProductEvent } from "./product-events.service";
import { chunkText } from "./chunking";
import { extractText } from "./parser.service";

export interface IndexResult {
  /** Number of chunks written; null when another run owns the row or the optimistic write was stale. */
  chunks: number | null;
}

/**
 * Re-chunks and re-embeds an entry. Status: pending|failed -> processing -> ready | failed.
 *
 * The claim only matches pending or failed, so two workers cannot both embed the same note.
 * A processing row is left alone until the retry job decides it was abandoned.
 * The claim returns updated_at, which acts as a version. The final write
 * (bitacora_replace_entry_embeddings) applies only if that version still matches,
 * so a stale run cannot overwrite a newer one.
 * Service role bypasses row level security; userId is the verified owner and every statement filters on it.
 */
export async function indexLedgerEntry(userId: string, entryId: string): Promise<IndexResult> {
  if (!userId) throw new Error("indexing requires the authenticated user id");
  const db = createAdminClient();

  const { data: entry, error } = await db
    .from("bitacora_ledger_entries")
    .update({ embedding_status: "processing" })
    .eq("id", entryId)
    .eq("user_id", userId)
    .in("embedding_status", ["pending", "failed"])
    .select("title, raw_text, source_file_path, source_mime_type, extracted_text, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!entry) return { chunks: null };

  try {
    // Extract once per file; the result is cached in extracted_text until the file changes.
    let extracted: string | null = entry.extracted_text;
    if (extracted === null && entry.source_file_path && entry.source_mime_type) {
      const bytes = await downloadAttachmentForUser(userId, entry.source_file_path);
      extracted = await extractText(bytes, entry.source_mime_type);
    }

    const body = [entry.raw_text, extracted].filter((s): s is string => !!s?.trim()).join("\n\n");
    const chunks = body.trim() ? chunkText(`${entry.title}\n\n${body}`) : [];
    const vectors = await embedTexts(chunks, "document");

    const { data: applied, error: rpcError } = await db.rpc("bitacora_replace_entry_embeddings", {
      p_entry_id: entryId,
      p_user_id: userId,
      p_expected_updated_at: entry.updated_at,
      p_extracted_text: extracted,
      p_chunks: chunks.map((content, i) => ({
        chunk_index: i,
        content,
        token_count: Math.ceil(content.length / 4),
        embedding: JSON.stringify(vectors[i]),
      })),
    });
    if (rpcError) throw rpcError;
    if (applied) await recordOwnedProductEvent(db, userId, "first_embedding_ready", { chunk_count: chunks.length });
    return { chunks: applied ? chunks.length : null };
  } catch (e) {
    // Only mark failed if nobody edited the entry meanwhile (otherwise it is already 'pending').
    await db
      .from("bitacora_ledger_entries")
      .update({ embedding_status: "failed" })
      .eq("id", entryId)
      .eq("user_id", userId)
      .eq("updated_at", entry.updated_at);
    throw e;
  }
}
