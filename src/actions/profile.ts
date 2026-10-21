"use server";

import { fail, fromPostgrest, ok, parse, requireUser } from "../lib/actions/helpers";
import { toProfile, type ProfileRow } from "../lib/actions/mappers";
import { updateProfileSchema } from "../lib/actions/schemas";
import type { ActionResponse, UpdateProfileInput, UserProfile } from "../types";

export async function getProfile(): Promise<ActionResponse<UserProfile>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const { data, error } = await auth.supabase.from("bitacora_profiles").select("*").eq("id", auth.userId).maybeSingle();
  if (error) return fromPostgrest(error);
  if (!data) return fail("not_found", "Profile not found.");
  return ok(toProfile(data as ProfileRow));
}

export async function updateProfile(input: UpdateProfileInput): Promise<ActionResponse<UserProfile>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const parsed = parse(updateProfileSchema, input);
  if (parsed.error) return { data: null, error: parsed.error };
  const v = parsed.value;

  const patch = {
    ...(v.displayName !== undefined && { display_name: v.displayName }),
    ...(v.role !== undefined && { role: v.role }),
    ...(v.academicLevel !== undefined && { academic_level: v.academicLevel }),
    ...(v.careerOrField !== undefined && { career_or_field: v.careerOrField }),
    ...(v.preferredLanguage !== undefined && { preferred_language: v.preferredLanguage }),
    ...(v.timezone !== undefined && { timezone: v.timezone }),
  };
  if (Object.keys(patch).length === 0) return fail("validation_error", "Nothing to update.");

  const { data, error } = await auth.supabase
    .from("bitacora_profiles")
    .update(patch)
    .eq("id", auth.userId)
    .select("*")
    .single();
  if (error) return fromPostgrest(error);
  return ok(toProfile(data as ProfileRow));
}

/** Marks the first-run guide finished for this owner. Does not clear it. */
export async function completeOnboarding(): Promise<ActionResponse<UserProfile>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const { data, error } = await auth.supabase
    .from("bitacora_profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", auth.userId)
    .select("*")
    .single();
  if (error) return fromPostgrest(error);
  return ok(toProfile(data as ProfileRow));
}
