"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createTeam, inviteTeamMember, listMyTeams, listTeamMembers, type TeamMember, type TeamSummary } from "../../actions/teams";
import { describeTeamError } from "../../lib/action-error";
import { useAuth } from "../../providers/auth-provider";
import { useTranslation } from "../../providers/i18n-provider";
import type { TeamRole } from "../../lib/teams";
import { Alert, Badge, Button, Card, Field, inputClass } from "../ui";

const ROLE_TONE: Record<TeamRole, "good" | "warn" | "neutral"> = { owner: "good", admin: "warn", member: "neutral" };

export function TeamsManager() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [pending, setPending] = useState<"create" | "invite" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    const res = await listMyTeams();
    if (res.error || !res.data) {
      setError(res.error ? describeTeamError(res.error, t) : t("teams.unavailable"));
      setTeams([]);
      return;
    }
    setTeams(res.data);
    setSelectedId((current) => (current && res.data.some((team) => team.id === current) ? current : res.data[0]?.id ?? null));
  }, [t]);

  const loadMembers = useCallback(
    async (teamId: string) => {
      setMembersLoading(true);
      const res = await listTeamMembers(teamId);
      setMembersLoading(false);
      if (res.error || !res.data) {
        setMembers([]);
        setError(res.error ? describeTeamError(res.error, t) : t("teams.unavailable"));
        return;
      }
      setMembers(res.data);
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadTeams();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTeams]);

  useEffect(() => {
    if (!selectedId) {
      setMembers([]);
      return;
    }
    void loadMembers(selectedId);
  }, [selectedId, loadMembers]);

  const selected = teams.find((team) => team.id === selectedId) ?? null;
  const canInvite = selected?.role === "owner" || selected?.role === "admin";

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setPending("create");
    setError(null);
    setNotice(null);
    const res = await createTeam({ name });
    setPending(null);
    if (res.error || !res.data) {
      setError(res.error ? describeTeamError(res.error, t) : t("teams.unavailable"));
      return;
    }
    setName("");
    setNotice(t("teams.created"));
    setSelectedId(res.data.id);
    await loadTeams();
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setPending("invite");
    setError(null);
    setNotice(null);
    const res = await inviteTeamMember({
      teamId: selected.id,
      email,
      role: selected.role === "owner" ? inviteRole : "member",
    });
    setPending(null);
    if (res.error) {
      setError(describeTeamError(res.error, t));
      return;
    }
    setEmail("");
    setInviteRole("member");
    setNotice(t("teams.invited"));
    await loadMembers(selected.id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("teams.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("teams.subtitle")}</p>
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Card title={t("teams.create")}>
        <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label={t("teams.name")}>
              <input
                required
                maxLength={120}
                value={name}
                placeholder={t("teams.namePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <Button type="submit" disabled={pending !== null}>
            {pending === "create" ? t("common.loading") : t("teams.create")}
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card title={t("teams.title")}>
          {loading ? (
            <p className="text-sm text-slate-500">{t("common.loading")}</p>
          ) : teams.length === 0 ? (
            <p className="text-sm text-slate-500">{t("teams.empty")}</p>
          ) : (
            <ul className="space-y-1">
              {teams.map((team) => {
                const active = team.id === selectedId;
                return (
                  <li key={team.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedId(team.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${active ? "bg-indigo-50 text-indigo-800" : "hover:bg-slate-50"}`}
                    >
                      <span className="font-medium">{team.name}</span>
                      <Badge tone={ROLE_TONE[team.role]}>{t(`teams.roles.${team.role}`)}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {selected && (
          <Card title={selected.name} description={t(`teams.roles.${selected.role}`)}>
            <h2 className="text-sm font-semibold text-slate-800">{t("teams.members")}</h2>
            {membersLoading ? (
              <p className="mt-2 text-sm text-slate-500">{t("common.loading")}</p>
            ) : members.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{t("teams.membersEmpty")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {members.map((member) => {
                  const mine = member.userId === user?.id;
                  const label = mine ? t("teams.you") : member.displayName || t("teams.collaborator");
                  return (
                    <li key={member.userId} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm text-slate-800">{label}</span>
                      <Badge tone={ROLE_TONE[member.role]}>{t(`teams.roles.${member.role}`)}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}

            {canInvite && (
              <form onSubmit={onInvite} className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                <Field label={t("teams.email")} hint={t("teams.emailHint")}>
                  <input
                    required
                    type="email"
                    autoComplete="off"
                    maxLength={320}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                {selected.role === "owner" && (
                  <Field label={t("teams.role")}>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value === "admin" ? "admin" : "member")}
                      className={inputClass}
                    >
                      <option value="member">{t("teams.roles.member")}</option>
                      <option value="admin">{t("teams.roles.admin")}</option>
                    </select>
                  </Field>
                )}
                <Button type="submit" disabled={pending !== null}>
                  {pending === "invite" ? t("common.loading") : t("teams.invite")}
                </Button>
              </form>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
