import type { ActionError } from "../types";
import type { TranslationKey, TranslationParams } from "./i18n";
import {
  FREE_ATTACHMENT_LIMIT,
  FREE_LEDGER_ENTRY_LIMIT,
  FREE_QUESTION_RATE_LIMIT,
  FREE_QUESTION_RATE_WINDOW_SECONDS,
  FREE_QUESTIONS_PER_MONTH,
} from "./plan-limits";

const QUOTA_COPY: Record<string, { key: TranslationKey; params: TranslationParams }> = {
  entry_quota_exceeded: { key: "quota.entries", params: { limit: FREE_LEDGER_ENTRY_LIMIT } },
  attachment_quota_exceeded: { key: "quota.attachments", params: { limit: FREE_ATTACHMENT_LIMIT } },
  question_quota_exceeded: { key: "quota.questions", params: { limit: FREE_QUESTIONS_PER_MONTH } },
  rate_limited: {
    key: "quota.rateLimited",
    params: { limit: FREE_QUESTION_RATE_LIMIT, seconds: FREE_QUESTION_RATE_WINDOW_SECONDS },
  },
};

/** Human-readable text for an action error. Quota codes use the active language when `t` is passed. */
export function describeError(
  error: ActionError,
  t?: (key: TranslationKey, params?: TranslationParams) => string,
): string {
  const quota = QUOTA_COPY[error.code];
  if (quota && t) return t(quota.key, quota.params);
  const fields = error.fields ? Object.values(error.fields) : [];
  return fields.length ? fields.join(" ") : error.message;
}

const TEAM_COPY: Record<string, TranslationKey> = {
  teams_unavailable: "teams.unavailable",
  already_member: "teams.alreadyMember",
  invitee_not_found: "teams.inviteeMissing",
  forbidden: "teams.forbidden",
};

/** Team-screen copy for the closed set of team action codes. Other errors keep the generic text. */
export function describeTeamError(error: ActionError, t: (key: TranslationKey, params?: TranslationParams) => string): string {
  const key = TEAM_COPY[error.code];
  if (key) return t(key);
  if (error.fields?.email) return t("teams.emailInvalid");
  if (error.fields?.name) return t("teams.nameInvalid");
  return describeError(error, t);
}
