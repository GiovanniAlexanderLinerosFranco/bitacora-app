"use server";

import { fail, fromPostgrest, ok, parse, requireUser, type ServerClient } from "../lib/actions/helpers";
import { scheduleIndexing } from "../lib/actions/indexing";
import { removeAttachment } from "../lib/supabase/storage";
import { toEntry, type EntryRow } from "../lib/actions/mappers";
import { createEntrySchema, idSchema, listEntriesSchema, updateEntrySchema } from "../lib/actions/schemas";
import type { ActionResponse, CreateLedgerEntryInput, EntryType, LedgerEntry } from "../types";

export interface ListEntriesParams {
  subjectId?: string;
  entryType?: EntryType;
  tag?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** Confirms the subject exists, belongs to the user, and is not archived. */
async function assertSubjectUsable(supabase: ServerClient, userId: string, subjectId: string) {
  const { data, error } = await supabase
    .from("bitacora_subjects_or_projects")
    .select("id, is_archived")
    .eq("id", subjectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return fromPostgrest(error);
  if (!data) return fail("forbidden_subject", "Subject not found.");
  if (data.is_archived) return fail("subject_archived", "Cannot add entries to an archived subject.");
  return null;
}

export async function createLedgerEntry(input: CreateLedgerEntryInput): Promise<ActionResponse<LedgerEntry>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const parsed = parse(createEntrySchema, input);
  if (parsed.error) return { data: null, error: parsed.error };
  const v = parsed.value;

  if (v.entryType !== "task" && (v.taskStatus || v.dueDate)) {
    return fail("validation_error", "Invalid input.", { taskStatus: "Only tasks have a status or due date." });
  }
  if (v.subjectId) {
    const bad = await assertSubjectUsable(auth.supabase, auth.userId, v.subjectId);
    if (bad) return bad;
  }

  const { data, error } = await auth.supabase
    .from("bitacora_ledger_entries")
    .insert({
      user_id: auth.userId,
      subject_id: v.subjectId ?? null,
      entry_type: v.entryType,
      title: v.title,
      raw_text: v.rawText ?? "",
      language: v.language ?? null,
      ...(v.entryDate && { entry_date: v.entryDate }),
      task_status: v.entryType === "task" ? (v.taskStatus ?? "todo") : null,
      due_date: v.dueDate ?? null,
      tags: v.tags ?? [],
      metadata: v.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) return fromPostgrest(error);
  const created = data as EntryRow;
  scheduleIndexing(auth.userId, created.id);
  return ok(toEntry(created));
}

export async function getLedgerEntry(id: string): Promise<ActionResponse<LedgerEntry>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(id).success) return fail("validation_error", "Invalid id.");

  const { data, error } = await auth.supabase
    .from("bitacora_ledger_entries")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) return fromPostgrest(error);
  if (!data) return fail("not_found", "Entry not found.");
  return ok(toEntry(data as EntryRow));
}

export async function listLedgerEntries(params: ListEntriesParams = {}): Promise<ActionResponse<LedgerEntry[]>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const parsed = parse(listEntriesSchema, params);
  if (parsed.error) return { data: null, error: parsed.error };
  const p = parsed.value;

  let q = auth.supabase.from("bitacora_ledger_entries").select("*").eq("user_id", auth.userId);
  if (p.subjectId) q = q.eq("subject_id", p.subjectId);
  if (p.entryType) q = q.eq("entry_type", p.entryType);
  if (p.tag) q = q.contains("tags", [p.tag.toLowerCase()]);
  if (p.from) q = q.gte("entry_date", p.from);
  if (p.to) q = q.lte("entry_date", p.to);

  const { data, error } = await q
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(p.offset, p.offset + p.limit - 1);
  if (error) return fromPostgrest(error);
  return ok((data as EntryRow[]).map(toEntry));
}

export async function updateLedgerEntry(
  id: string,
  input: Partial<CreateLedgerEntryInput>,
): Promise<ActionResponse<LedgerEntry>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(id).success) return fail("validation_error", "Invalid id.");

  const parsed = parse(updateEntrySchema, input);
  if (parsed.error) return { data: null, error: parsed.error };
  const v = parsed.value;

  const { data: existing, error: readErr } = await auth.supabase
    .from("bitacora_ledger_entries")
    .select("entry_type, subject_id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (readErr) return fromPostgrest(readErr);
  if (!existing) return fail("not_found", "Entry not found.");

  const finalType = v.entryType ?? existing.entry_type;
  if (finalType !== "task" && (v.taskStatus || v.dueDate)) {
    return fail("validation_error", "Invalid input.", { taskStatus: "Only tasks have a status or due date." });
  }
  if (v.subjectId && v.subjectId !== existing.subject_id) {
    const bad = await assertSubjectUsable(auth.supabase, auth.userId, v.subjectId);
    if (bad) return bad;
  }

  const contentChanged = v.title !== undefined || v.rawText !== undefined;
  const patch = {
    ...(v.subjectId !== undefined && { subject_id: v.subjectId }),
    ...(v.entryType !== undefined && { entry_type: v.entryType }),
    ...(v.title !== undefined && { title: v.title }),
    ...(v.rawText !== undefined && { raw_text: v.rawText }),
    ...(v.language !== undefined && { language: v.language }),
    ...(v.entryDate !== undefined && { entry_date: v.entryDate }),
    ...(v.taskStatus !== undefined && { task_status: v.taskStatus }),
    ...(v.dueDate !== undefined && { due_date: v.dueDate }),
    ...(v.tags !== undefined && { tags: v.tags }),
    ...(v.metadata !== undefined && { metadata: v.metadata }),
    // Stale embeddings must be rebuilt after the text changes.
    ...(contentChanged && { embedding_status: "pending" as const }),
    // Leaving the task type clears task-only fields.
    ...(finalType !== "task" && { task_status: null, due_date: null }),
  };
  if (Object.keys(patch).length === 0) return fail("validation_error", "Nothing to update.");

  const { data, error } = await auth.supabase
    .from("bitacora_ledger_entries")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();
  if (error) return fromPostgrest(error);
  if (!data) return fail("not_found", "Entry not found.");
  if (contentChanged) scheduleIndexing(auth.userId, id);
  return ok(toEntry(data as EntryRow));
}

/** Retries indexing for a 'failed' or 'pending' entry. */
export async function reindexLedgerEntry(id: string): Promise<ActionResponse<LedgerEntry>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(id).success) return fail("validation_error", "Invalid id.");

  const { data, error } = await auth.supabase
    .from("bitacora_ledger_entries")
    .update({ embedding_status: "pending" })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .neq("embedding_status", "processing")
    .select("*")
    .maybeSingle();
  if (error) return fromPostgrest(error);
  if (!data) return fail("not_found", "Entry not found or already being processed.");
  scheduleIndexing(auth.userId, id);
  return ok(toEntry(data as EntryRow));
}

/** Deletes the entry; its embedding chunks are removed by ON DELETE CASCADE. */
export async function deleteLedgerEntry(id: string): Promise<ActionResponse<{ id: string }>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(id).success) return fail("validation_error", "Invalid id.");

  const { data, error } = await auth.supabase
    .from("bitacora_ledger_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id, source_file_path");
  if (error) return fromPostgrest(error);
  if (!data?.length) return fail("not_found", "Entry not found.");
  if (data[0].source_file_path) await removeAttachment(auth.supabase, data[0].source_file_path);
  return ok({ id });
}
