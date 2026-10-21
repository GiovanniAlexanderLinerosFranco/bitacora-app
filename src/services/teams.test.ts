import { describe, expect, it } from "vitest";
import {
  embeddingSearch,
  personalEntryAfterShare,
  planCreateTeam,
  planInvite,
  planShare,
  teamSlug,
  visibleNoteIds,
  type PersonalNote,
  type SharedSubjectCopy,
  type TeamMembership,
} from "../lib/teams";

const OWNER = "11111111-1111-4111-8111-111111111111";
const MEMBER = "22222222-2222-4222-8222-222222222222";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";
const TEAM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUBJECT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_SUBJECT = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const PRIVATE_NOTE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHARED_NOTE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const UNCOPIED_NOTE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const notes: PersonalNote[] = [
  { id: PRIVATE_NOTE, userId: OWNER, subjectId: null },
  { id: SHARED_NOTE, userId: OWNER, subjectId: SUBJECT },
  { id: UNCOPIED_NOTE, userId: OWNER, subjectId: SUBJECT },
];

const memberships: TeamMembership[] = [
  { teamId: TEAM, userId: OWNER, role: "owner" },
  { teamId: TEAM, userId: MEMBER, role: "member" },
];

const shares: SharedSubjectCopy[] = [{ teamId: TEAM, subjectId: SUBJECT, copiedEntryIds: [SHARED_NOTE] }];

describe("planCreateTeam", () => {
  it("creates the team and assigns the creator as owner", () => {
    expect(planCreateTeam(OWNER, "  Lab de Genética  ")).toEqual({
      name: "Lab de Genética",
      slug: "lab-de-genetica",
      ownerId: OWNER,
      member: { userId: OWNER, role: "owner" },
    });
    expect(teamSlug("!!!")).toBe("team");
  });

  it("rejects a blank or oversized name", () => {
    expect(planCreateTeam(OWNER, "   ")).toEqual({ error: "validation" });
    expect(planCreateTeam(OWNER, "a".repeat(121))).toEqual({ error: "validation" });
    expect(planCreateTeam("", "Lab")).toEqual({ error: "validation" });
  });
});

describe("planInvite", () => {
  it("lets an owner invite a member or an admin, and an admin invite a member", () => {
    expect(planInvite({ callerRole: "owner", email: " Ana@Lab.edu " })).toEqual({ email: "ana@lab.edu", role: "member" });
    expect(planInvite({ callerRole: "owner", email: "ana@lab.edu", role: "admin" })).toEqual({ email: "ana@lab.edu", role: "admin" });
    expect(planInvite({ callerRole: "admin", email: "ana@lab.edu", role: "member" })).toEqual({ email: "ana@lab.edu", role: "member" });
  });

  it("rejects a member, an owner grant, an admin granting admin, and a bad email", () => {
    expect(planInvite({ callerRole: "member", email: "ana@lab.edu" })).toEqual({ error: "forbidden" });
    expect(planInvite({ callerRole: null, email: "ana@lab.edu" })).toEqual({ error: "forbidden" });
    expect(planInvite({ callerRole: "owner", email: "ana@lab.edu", role: "owner" })).toEqual({ error: "forbidden" });
    expect(planInvite({ callerRole: "admin", email: "ana@lab.edu", role: "admin" })).toEqual({ error: "forbidden" });
    expect(planInvite({ callerRole: "owner", email: "not-an-email" })).toEqual({ error: "validation" });
  });
});

describe("planShare", () => {
  it("allows an owner or admin to publish only a subject they own", () => {
    expect(planShare({ callerRole: "owner", callerId: OWNER, subjectOwnerId: OWNER })).toEqual({ ok: true });
    expect(planShare({ callerRole: "admin", callerId: OWNER, subjectOwnerId: OWNER })).toEqual({ ok: true });
    expect(planShare({ callerRole: "member", callerId: OWNER, subjectOwnerId: OWNER })).toEqual({ error: "forbidden" });
    expect(planShare({ callerRole: "owner", callerId: OWNER, subjectOwnerId: MEMBER })).toEqual({ error: "forbidden" });
  });
});

describe("personal notes stay private", () => {
  it("shows a personal note only to its owner, including after a subject is shared", () => {
    expect(visibleNoteIds(notes, memberships, shares, { corpus: "personal", callerId: OWNER })).toEqual([
      PRIVATE_NOTE,
      SHARED_NOTE,
      UNCOPIED_NOTE,
    ]);
    expect(visibleNoteIds(notes, memberships, shares, { corpus: "personal", callerId: MEMBER })).toEqual([]);
    expect(visibleNoteIds(notes, memberships, shares, { corpus: "personal", callerId: OUTSIDER })).toEqual([]);
    expect(personalEntryAfterShare(notes[0])).toEqual(notes[0]);
    expect(personalEntryAfterShare(notes[1])).not.toHaveProperty("teamId");
  });

  it("lets a member read the copied note and hides notes that were never copied", () => {
    expect(visibleNoteIds(notes, memberships, shares, { corpus: "team", callerId: MEMBER, teamId: TEAM })).toEqual([SHARED_NOTE]);
    expect(visibleNoteIds(notes, memberships, shares, { corpus: "team", callerId: MEMBER, teamId: TEAM, subjectId: SUBJECT })).toEqual([
      SHARED_NOTE,
    ]);
    expect(visibleNoteIds(notes, memberships, shares, { corpus: "team", callerId: MEMBER, teamId: TEAM, subjectId: OTHER_SUBJECT })).toEqual(
      [],
    );
    expect(visibleNoteIds(notes, memberships, shares, { corpus: "team", callerId: OUTSIDER, teamId: TEAM })).toEqual([]);
  });

  it("sends the personal tutor and the team tutor to different embedding searches", () => {
    expect(embeddingSearch({})).toBe("bitacora_match_document_embeddings");
    expect(embeddingSearch({ teamId: null })).toBe("bitacora_match_document_embeddings");
    expect(embeddingSearch({ teamId: TEAM })).toBe("bitacora_match_team_embeddings");
  });
});
