"use server";

import { fail, fromPostgrest, ok, parse, requireUser } from "../lib/actions/helpers";
import { toSubject, type SubjectRow } from "../lib/actions/mappers";
import { createSubjectSchema, idSchema, updateSubjectSchema } from "../lib/actions/schemas";
import type { ActionResponse, CreateSubjectInput, SubjectOrProject } from "../types";

// All queries also filter by user_id explicitly; RLS (auth.uid()) is the second layer.

export async function listSubjects(
  opts: { includeArchived?: boolean } = {},
): Promise<ActionResponse<SubjectOrProject[]>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  let q = auth.supabase.from("bitacora_subjects_or_projects").select("*").eq("user_id", auth.userId);
  if (!opts.includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q.order("name", { ascending: true });
  if (error) return fromPostgrest(error);
  return ok((data as SubjectRow[]).map(toSubject));
}

export async function getSubject(id: string): Promise<ActionResponse<SubjectOrProject>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(id).success) return fail("validation_error", "Invalid id.");

  const { data, error } = await auth.supabase
    .from("bitacora_subjects_or_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) return fromPostgrest(error);
  if (!data) return fail("not_found", "Subject not found.");
  return ok(toSubject(data as SubjectRow));
}

export async function createSubject(input: CreateSubjectInput): Promise<ActionResponse<SubjectOrProject>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const parsed = parse(createSubjectSchema, input);
  if (parsed.error) return { data: null, error: parsed.error };
  const v = parsed.value;

  const { data, error } = await auth.supabase
    .from("bitacora_subjects_or_projects")
    .insert({ user_id: auth.userId, kind: v.kind, name: v.name, description: v.description ?? null, color: v.color ?? null })
    .select("*")
    .single();
  if (error) return fromPostgrest(error);
  return ok(toSubject(data as SubjectRow));
}

export async function updateSubject(
  id: string,
  input: Partial<CreateSubjectInput> & { isArchived?: boolean },
): Promise<ActionResponse<SubjectOrProject>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(id).success) return fail("validation_error", "Invalid id.");

  const parsed = parse(updateSubjectSchema, input);
  if (parsed.error) return { data: null, error: parsed.error };
  const v = parsed.value;

  const patch = {
    ...(v.kind !== undefined && { kind: v.kind }),
    ...(v.name !== undefined && { name: v.name }),
    ...(v.description !== undefined && { description: v.description }),
    ...(v.color !== undefined && { color: v.color }),
    ...(v.isArchived !== undefined && { is_archived: v.isArchived }),
  };
  if (Object.keys(patch).length === 0) return fail("validation_error", "Nothing to update.");

  const { data, error } = await auth.supabase
    .from("bitacora_subjects_or_projects")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();
  if (error) return fromPostgrest(error);
  if (!data) return fail("not_found", "Subject not found.");
  return ok(toSubject(data as SubjectRow));
}

export async function archiveSubject(id: string, archived = true): Promise<ActionResponse<SubjectOrProject>> {
  return updateSubject(id, { isArchived: archived });
}

/** Permanently deletes the subject; its ledger entries are kept and become unassigned (ON DELETE SET NULL). */
export async function deleteSubject(id: string): Promise<ActionResponse<{ id: string }>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!idSchema.safeParse(id).success) return fail("validation_error", "Invalid id.");

  const { data, error } = await auth.supabase
    .from("bitacora_subjects_or_projects")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id");
  if (error) return fromPostgrest(error);
  if (!data?.length) return fail("not_found", "Subject not found.");
  return ok({ id });
}
