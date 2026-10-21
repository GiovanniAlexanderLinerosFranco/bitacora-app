/** Layer 2 decisions that do not touch the database. The migration enforces the same rules. */

export const TEAM_ROLES = ["owner", "admin", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export type EmbeddingSearch = "bitacora_match_document_embeddings" | "bitacora_match_team_embeddings";

const SLUG_MAX = 60;
const NAME_MAX = 120;

export interface TeamMembership {
  teamId: string;
  userId: string;
  role: TeamRole;
}

export interface PersonalNote {
  id: string;
  userId: string;
  subjectId: string | null;
}

/** A voluntary copy into the team corpus. The original personal row is not in this list. */
export interface SharedSubjectCopy {
  teamId: string;
  subjectId: string;
  copiedEntryIds: readonly string[];
}

export type NoteQuery =
  | { corpus: "personal"; callerId: string }
  | { corpus: "team"; callerId: string; teamId: string; subjectId?: string | null };

export type CreateTeamPlan = {
  name: string;
  slug: string;
  ownerId: string;
  member: { userId: string; role: "owner" };
};

export type InvitePlan = { email: string; role: "admin" | "member" };

/** Turns a team name into a URL slug. Accents are stripped; a blank result becomes "team". */
export function teamSlug(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length >= 2 ? base.slice(0, SLUG_MAX) : "team";
}

/** Appends a short suffix when the slug is already taken, staying inside the column limit. */
export function withSlugSuffix(slug: string, suffix: string): string {
  const extra = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "2";
  return `${slug.slice(0, SLUG_MAX - extra.length - 1)}-${extra}`;
}

export function planCreateTeam(callerId: string, name: string): CreateTeamPlan | { error: "validation" } {
  const trimmed = name.trim();
  if (!callerId || trimmed.length < 1 || trimmed.length > NAME_MAX) return { error: "validation" };
  return {
    name: trimmed,
    slug: teamSlug(trimmed),
    ownerId: callerId,
    member: { userId: callerId, role: "owner" },
  };
}

function normalizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length < 3 || trimmed.length > 320) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Owner may invite a member or an admin. An admin may invite a member.
 * The owner role is created with the team and is never granted by invitation.
 */
export function planInvite(input: {
  callerRole: TeamRole | null;
  email: string;
  role?: string;
}): InvitePlan | { error: "forbidden" | "validation" } {
  const email = normalizeEmail(input.email);
  if (!email) return { error: "validation" };
  const role = input.role ?? "member";
  if (role !== "member" && role !== "admin") return { error: "forbidden" };
  if (input.callerRole === "owner") return { email, role };
  if (input.callerRole === "admin" && role === "member") return { email, role };
  return { error: "forbidden" };
}

/** Only an owner or admin can publish, and only a subject they themselves own. */
export function planShare(input: {
  callerRole: TeamRole | null;
  callerId: string;
  subjectOwnerId: string;
}): { ok: true } | { error: "forbidden" } {
  if (input.callerRole !== "owner" && input.callerRole !== "admin") return { error: "forbidden" };
  if (!input.callerId || input.callerId !== input.subjectOwnerId) return { error: "forbidden" };
  return { ok: true };
}

/**
 * Personal search uses the personal embedding function. Team search uses the team copy.
 * Passing a team id never falls through to the personal corpus.
 */
export function embeddingSearch(query: { teamId?: string | null }): EmbeddingSearch {
  return query.teamId ? "bitacora_match_team_embeddings" : "bitacora_match_document_embeddings";
}

/** Sharing records a copy. It does not add a team id to the personal note. */
export function personalEntryAfterShare<T extends PersonalNote>(entry: T): T {
  return { ...entry };
}

/**
 * Personal mode returns only notes whose user id is the caller.
 * Team mode returns only entry ids that were copied into that team, and only for a member.
 * A note that was never copied stays out, even when it sits in a subject the team can see.
 */
export function visibleNoteIds(
  notes: readonly PersonalNote[],
  memberships: readonly TeamMembership[],
  shares: readonly SharedSubjectCopy[],
  query: NoteQuery,
): string[] {
  if (query.corpus === "personal") {
    return notes.filter((note) => note.userId === query.callerId).map((note) => note.id);
  }
  const isMember = memberships.some((row) => row.teamId === query.teamId && row.userId === query.callerId);
  if (!isMember) return [];
  const ids: string[] = [];
  for (const share of shares) {
    if (share.teamId !== query.teamId) continue;
    if (query.subjectId && share.subjectId !== query.subjectId) continue;
    for (const id of share.copiedEntryIds) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}
