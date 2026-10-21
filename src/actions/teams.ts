"use server";

import { randomBytes } from "crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { fail, fromPostgrest, ok, requireUser } from "../lib/actions/helpers";
import { planCreateTeam, planInvite, withSlugSuffix, type TeamRole } from "../lib/teams";
import type { ActionResponse } from "../types";

export interface Team {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface TeamInvite {
  memberId: string;
  role: "admin" | "member";
}

export interface SharedSubject {
  id: string;
  teamId: string;
  subjectId: string;
  copiedChunks: number;
}

export interface TeamSummary extends Team {
  role: TeamRole;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  joinedAt: string;
  displayName: string | null;
}

export interface SharedSubjectLink {
  id: string;
  teamId: string;
  subjectId: string;
  subjectName: string;
  createdAt: string;
}

function asRole(value: unknown): TeamRole | null {
  return value === "owner" || value === "admin" || value === "member" ? value : null;
}

function unavailable<T>(error: PostgrestError): ActionResponse<T> | null {
  if (error.code === "PGRST205" || error.code === "42P01") return fail("teams_unavailable", "Teams are not available right now.");
  return null;
}

function teamError<T>(error: PostgrestError): ActionResponse<T> {
  const message = error.message ?? "";
  if (message.includes("invitee_not_found")) return fail("invitee_not_found", "No account uses that email.");
  if (message.includes("already_member")) return fail("already_member", "That person is already on the team.");
  if (message.includes("subject_not_owned")) return fail("forbidden", "You can only share a subject you own.");
  if (message.includes("forbidden")) return fail("forbidden", "You are not allowed to manage this team.");
  if (message.includes("validation")) return fail("validation_error", "Invalid input.");
  return fromPostgrest(error);
}

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

function toTeam(row: TeamRow): Team {
  return { id: row.id, name: row.name, slug: row.slug, ownerId: row.owner_id, createdAt: row.created_at };
}

const ROLE_ORDER: Record<TeamRole, number> = { owner: 0, admin: 1, member: 2 };

/** Teams the signed-in user belongs to. Membership is filtered in the query and again by row level security. */
export async function listMyTeams(): Promise<ActionResponse<TeamSummary[]>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const { data: memberships, error } = await auth.supabase
    .from("bitacora_team_members")
    .select("team_id, role")
    .eq("user_id", auth.userId);
  if (error) return unavailable(error) ?? fromPostgrest(error);
  const roleByTeam = new Map<string, TeamRole>();
  for (const row of memberships ?? []) {
    const role = asRole(row.role);
    if (typeof row.team_id === "string" && role) roleByTeam.set(row.team_id, role);
  }
  if (roleByTeam.size === 0) return ok([]);

  const { data: teams, error: teamsError } = await auth.supabase
    .from("bitacora_teams")
    .select("id, name, slug, owner_id, created_at")
    .in("id", [...roleByTeam.keys()])
    .order("name", { ascending: true });
  if (teamsError) return unavailable(teamsError) ?? fromPostgrest(teamsError);

  return ok(
    ((teams ?? []) as TeamRow[])
      .filter((row) => roleByTeam.has(row.id))
      .map((row) => ({ ...toTeam(row), role: roleByTeam.get(row.id) ?? "member" })),
  );
}

/** Members of one team. Display names come from the roster function; email addresses are not returned. */
export async function listTeamMembers(teamId: string): Promise<ActionResponse<TeamMember[]>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!teamId) return fail("validation_error", "Invalid input.", { teamId: "Required." });

  const { data: mine, error: mineError } = await auth.supabase
    .from("bitacora_team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (mineError) return unavailable(mineError) ?? fromPostgrest(mineError);
  if (!asRole(mine?.role)) return fail("forbidden", "You are not allowed to manage this team.");

  const { data, error } = await auth.supabase.rpc("bitacora_team_roster", { p_team: teamId });
  if (error?.code === "PGRST202") {
    const { data: rows, error: rowsError } = await auth.supabase
      .from("bitacora_team_members")
      .select("user_id, role, joined_at")
      .eq("team_id", teamId);
    if (rowsError) return fromPostgrest(rowsError);
    return ok(sortMembers((rows ?? []).map((row: { user_id?: string; role?: string; joined_at?: string }) => toMember(row, null))));
  }
  if (error) return unavailable(error) ?? teamError(error);
  return ok(
    sortMembers(
      ((data ?? []) as Array<{ user_id?: string; role?: string; joined_at?: string; display_name?: string | null }>).map((row) =>
        toMember(row, row.display_name ?? null),
      ),
    ),
  );
}

function toMember(row: { user_id?: string; role?: string; joined_at?: string }, displayName: string | null): TeamMember | null {
  const role = asRole(row.role);
  if (!row.user_id || !role) return null;
  const name = typeof displayName === "string" ? displayName.trim() : "";
  return { userId: row.user_id, role, joinedAt: row.joined_at ?? "", displayName: name || null };
}

function sortMembers(rows: Array<TeamMember | null>): TeamMember[] {
  return rows
    .filter((row): row is TeamMember => row !== null)
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.userId.localeCompare(b.userId));
}

/** Share links visible to the caller. Personal ledger rows are not included. */
export async function listSharedSubjects(): Promise<ActionResponse<SharedSubjectLink[]>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const { data, error } = await auth.supabase
    .from("bitacora_shared_subjects")
    .select("id, team_id, subject_id, subject_name, created_at")
    .order("created_at", { ascending: true });
  if (error && (error.code === "42703" || error.code === "PGRST204" || error.message.includes("subject_name"))) {
    const fallback = await auth.supabase.from("bitacora_shared_subjects").select("id, team_id, subject_id, created_at");
    if (fallback.error) return unavailable(fallback.error) ?? fromPostgrest(fallback.error);
    return ok((fallback.data ?? []).flatMap((row) => {
      const share = toShare(row, "");
      return share.id && share.teamId && share.subjectId ? [share] : [];
    }));
  }
  if (error) return unavailable(error) ?? fromPostgrest(error);
  return ok((data ?? []).flatMap((row) => {
    const share = toShare(row, (row as { subject_name?: string | null }).subject_name ?? "");
    return share.id && share.teamId && share.subjectId ? [share] : [];
  }));
}

function toShare(
  row: { id?: string; team_id?: string; subject_id?: string; created_at?: string },
  subjectName: string,
): SharedSubjectLink {
  return {
    id: row.id ?? "",
    teamId: row.team_id ?? "",
    subjectId: row.subject_id ?? "",
    subjectName,
    createdAt: row.created_at ?? "",
  };
}

/** Creates a team and records the signed-in user as its owner in the same database function. */
export async function createTeam(input: { name: string }): Promise<ActionResponse<Team>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const plan = planCreateTeam(auth.userId, input?.name ?? "");
  if ("error" in plan) return fail("validation_error", "Invalid input.", { name: "Use 1 to 120 characters." });

  let slug = plan.slug;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await auth.supabase.rpc("bitacora_create_team", { p_name: plan.name, p_slug: slug });
    if (!error && data) return ok(toTeam(data as TeamRow));
    if (error?.message?.includes("slug_taken") && attempt < 3) {
      slug = withSlugSuffix(plan.slug, randomBytes(4).toString("hex"));
      continue;
    }
    if (error) return teamError(error);
  }
  return fail("db_error", "The operation could not be completed.");
}

/** Adds someone who already has an account. The address is used only to find that account. */
export async function inviteTeamMember(input: {
  teamId: string;
  email: string;
  role?: "admin" | "member";
}): Promise<ActionResponse<TeamInvite>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!input?.teamId) return fail("validation_error", "Invalid input.", { teamId: "Required." });

  const { data: membership, error: membershipError } = await auth.supabase
    .from("bitacora_team_members")
    .select("role")
    .eq("team_id", input.teamId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (membershipError) return fromPostgrest(membershipError);

  const plan = planInvite({
    callerRole: membership?.role === "owner" || membership?.role === "admin" || membership?.role === "member" ? membership.role : null,
    email: input.email ?? "",
    role: input.role,
  });
  if ("error" in plan) {
    if (plan.error === "forbidden") return fail("forbidden", "You are not allowed to manage this team.");
    return fail("validation_error", "Invalid input.", { email: "Use a valid email address." });
  }

  const { data, error } = await auth.supabase.rpc("bitacora_invite_team_member", {
    p_team: input.teamId,
    p_email: plan.email,
    p_role: plan.role,
  });
  if (error) return teamError(error);
  const row = data as { member_id?: string; role?: "admin" | "member" } | null;
  if (!row?.member_id || (row.role !== "admin" && row.role !== "member")) {
    return fail("db_error", "The operation could not be completed.");
  }
  return ok({ memberId: row.member_id, role: row.role });
}

/**
 * Publishes the caller's subject into the team corpus.
 * Personal ledger rows stay private; members later search the copied chunks.
 */
export async function shareSubjectWithTeam(input: { teamId: string; subjectId: string }): Promise<ActionResponse<SharedSubject>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };
  if (!input?.teamId || !input.subjectId) return fail("validation_error", "Invalid input.");

  const { data, error } = await auth.supabase.rpc("bitacora_share_subject_with_team", {
    p_team: input.teamId,
    p_subject: input.subjectId,
  });
  if (error) return teamError(error);
  const row = data as { id?: string; team_id?: string; subject_id?: string; copied_chunks?: number } | null;
  if (!row?.id || row.team_id !== input.teamId || row.subject_id !== input.subjectId || typeof row.copied_chunks !== "number") {
    return fail("db_error", "The operation could not be completed.");
  }
  return ok({ id: row.id, teamId: row.team_id, subjectId: row.subject_id, copiedChunks: row.copied_chunks });
}
