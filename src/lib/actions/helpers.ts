import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ZodError, ZodType } from "zod";
import { createClient } from "../supabase/server";
import type { ActionError, ActionResponse } from "../../types";

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const ok = <T>(data: T): ActionResponse<T> => ({ data, error: null });
export const fail = <T = never>(code: string, message: string, fields?: Record<string, string>): ActionResponse<T> => ({
  data: null,
  error: { code, message, fields },
});

export function fromPostgrest<T = never>(e: PostgrestError): ActionResponse<T> {
  // Log details server-side; return a generic message for unexpected failures.
  console.error("[db]", e.code, e.message);
  if (e.code === "23503") return fail("invalid_reference", "A referenced record does not exist.");
  if (e.code === "PGRST116") return fail("not_found", "Record not found.");
  if (e.message.includes("does not belong to user")) return fail("forbidden_subject", "Subject not found.");
  return fail("db_error", "The operation could not be completed.");
}

export function fromZod<T = never>(err: ZodError): ActionResponse<T> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
  return fail("validation_error", "Invalid input.", fields);
}

export function parse<S>(schema: ZodType<S>, input: unknown): { value: S; error: null } | { value: null; error: ActionError } {
  const r = schema.safeParse(input);
  if (r.success) return { value: r.data, error: null };
  const res = fromZod(r.error);
  return { value: null, error: res.error! };
}

/** Resolves the authenticated user (verified with Supabase, not just the cookie) and a user-scoped client. */
export async function requireUser(): Promise<
  { supabase: ServerClient; userId: string; error: null } | { supabase: null; userId: null; error: ActionError }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { supabase: null, userId: null, error: { code: "unauthorized", message: "Please sign in to continue." } };
  }
  return { supabase, userId: data.user.id, error: null };
}
