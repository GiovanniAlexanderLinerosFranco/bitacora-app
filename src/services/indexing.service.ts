import "server-only";
import { createAdminClient } from "../lib/supabase/admin";
import { downloadAttachmentForUser } from "../lib/supabase/storage";
import { embedTexts } from "../lib/ai/openai";
import { chunkText } from "./chunking";
import { extractText } from "./parser.service";

export interface IndexResult {
  /** Number of chunks written; null when the entry changed mid-run and a newer run owns it. */
  chunks: number | null;
}

/**
 * Re-chunks and re-embeds an entry. Status: pending -> processing -> ready | failed.
 *
 * Concurrency: the 'processing' claim returns the row's updated_at, which acts as a version.
 * The final write (bitacora_replace_entry_embeddings RPC) is atomic and only applies if the version still matches,
 * so a stale run can never overwrite a newer one; an edit meanwhile leaves the entry 'pending' for its own run.
 */
export async function indexLedgerEntry(userId: string, entryId: string): Promise<IndexResult> {
  const db = createAdminClient();

  const { data: entry, error } = await db
    .from("bitacora_ledger_entries")
    .update({ embedding_status: "processing" })
    .eq("id", entryId)
    .eq("user_id", userId)
    .select("title, raw_text, source_file_path, source_mime_type, extracted_text, updated_at")
    .single();
  if (error || !entry) throw new Error("Ledger entry not found");

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
