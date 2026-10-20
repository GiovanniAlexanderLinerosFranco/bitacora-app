import type { TranslationKey } from "./i18n";

/** Only same-origin relative paths may be used as post-auth destinations. */
export function safeNext(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/dashboard";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns the translation key of the first violated password rule, or null when valid. */
export function passwordError(password: string): TranslationKey | null {
  if (password.length < 8) return "auth.errors.passwordTooShort";
  if (!/[A-Z]/.test(password)) return "auth.errors.passwordUppercase";
  if (!/[0-9]/.test(password)) return "auth.errors.passwordNumber";
  if (!/[^A-Za-z0-9]/.test(password)) return "auth.errors.passwordSymbol";
  return null;
}

/** Maps a Supabase auth error to a translation key, or null to fall back to its raw message. */
export function authErrorKey(err: { message: string; status?: number; code?: string }): TranslationKey | null {
  const m = err.message.toLowerCase();
  if (err.status === 429 || err.code === "over_request_rate_limit" || err.code === "over_email_send_rate_limit") return "auth.errors.rateLimited";
  if (m.includes("invalid login credentials")) return "auth.errors.invalidCredentials";
  if (m.includes("email not confirmed")) return "auth.errors.emailNotConfirmed";
  if (m.includes("token has expired") || m.includes("invalid") && m.includes("token")) return "auth.errors.codeInvalid";
  return null;
}
