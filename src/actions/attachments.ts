"use server";

import { fail, fromPostgrest, ok, requireUser } from "../lib/actions/helpers";
import { scheduleIndexing } from "../lib/actions/indexing";
import { assertFreeAttachmentQuota } from "../lib/quotas";
import { toEntry, type EntryRow } from "../lib/actions/mappers";
import { idSchema } from "../lib/actions/schemas";
import { MAX_ATTACHMENT_BYTES, classifyMime, normalizeMime } from "../lib/attachments";
import {
  buildAttachmentPath,
  createAttachmentUrl,
  removeAttachment,
  uploadAttachment,
} from "../lib/supabase/storage";
import { matchesDeclaredType } from "../services/parser.service";
import type { ActionResponse, LedgerEntry } from "../types";

/** Attaches (or replaces) the source file of an entry. FormData field: `file`. Indexing runs in the background. */
export async function uploadEntryAttachment(entryId: string, formData: FormData): Promise<ActionResponse<LedgerEntry>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(entryId).success) return fail("validation_error", "Invalid id.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("validation_error", "Invalid input.", { file: "A file is required." });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return fail("file_too_large", `File exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`, { file: "File too large." });
  }
  const mime = normalizeMime(file.type);
  if (!classifyMime(mime)) return fail("unsupported_type", "Unsupported file type.", { file: "Unsupported file type." });
  if (!matchesDeclaredType(new Uint8Array(await file.slice(0, 4096).arrayBuffer()), mime)) {
    return fail("invalid_file", "File content does not match its type.", { file: "File content does not match its type." });
  }

  const { data: existing, error: readErr } = await auth.supabase
    .from("bitacora_ledger_entries")
    .select("id, source_file_path")
    .eq("id", entryId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (readErr) return fromPostgrest(readErr);
  if (!existing) return fail("not_found", "Entry not found.");
  if (!existing.source_file_path) {
    const overQuota = await assertFreeAttachmentQuota(auth.supabase, auth.userId);
    if (overQuota) return overQuota;
  }

  const path = buildAttachmentPath(auth.userId, entryId, file.name);
  const upload = await uploadAttachment(auth.supabase, path, file, mime);
  if (upload.error) {
    console.error("[storage] upload failed", upload.error);
    return fail("upload_failed", "The file could not be uploaded.");
  }

  const { data, error } = await auth.supabase
    .from("bitacora_ledger_entries")
    .update({ source_file_path: path, source_mime_type: mime, extracted_text: null, embedding_status: "pending" })
    .eq("id", entryId)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    await removeAttachment(auth.supabase, path); // don't leave orphans
    return error ? fromPostgrest(error) : fail("not_found", "Entry not found.");
  }

  if (existing.source_file_path) await removeAttachment(auth.supabase, existing.source_file_path);
  scheduleIndexing(auth.userId, entryId);
  return ok(toEntry(data as EntryRow));
}

export async function removeEntryAttachment(entryId: string): Promise<ActionResponse<LedgerEntry>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(entryId).success) return fail("validation_error", "Invalid id.");

  const { data: existing } = await auth.supabase
    .from("bitacora_ledger_entries")
    .select("source_file_path")
    .eq("id", entryId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!existing) return fail("not_found", "Entry not found.");

  const { data, error } = await auth.supabase
    .from("bitacora_ledger_entries")
    .update({ source_file_path: null, source_mime_type: null, extracted_text: null, embedding_status: "pending" })
    .eq("id", entryId)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();
  if (error) return fromPostgrest(error);
  if (!data) return fail("not_found", "Entry not found.");

  if (existing.source_file_path) await removeAttachment(auth.supabase, existing.source_file_path);
  scheduleIndexing(auth.userId, entryId); // re-index so the file's chunks are dropped
  return ok(toEntry(data as EntryRow));
}

/** Short-lived signed URL for downloading/viewing the attachment. */
export async function getEntryAttachmentUrl(entryId: string): Promise<ActionResponse<{ url: string; expiresIn: number }>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(entryId).success) return fail("validation_error", "Invalid id.");

  const { data: entry } = await auth.supabase
    .from("bitacora_ledger_entries")
    .select("source_file_path")
    .eq("id", entryId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!entry?.source_file_path) return fail("not_found", "No attachment.");

  const expiresIn = 300;
  const { url, error } = await createAttachmentUrl(auth.supabase, entry.source_file_path, expiresIn);
  if (error || !url) return fail("storage_error", "Could not create a download link.");
  return ok({ url, expiresIn });
}
