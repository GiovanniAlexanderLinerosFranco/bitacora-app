"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "../../lib/supabase/client";
import { SUPPORTED_LOCALES } from "../../locales";
import { useTranslation } from "../../providers/i18n-provider";
import type { Locale, UserRole } from "../../types";
import { Alert, Button, Card, Field, inputClass } from "../ui";

/** Only same-origin relative paths may be used as post-login destinations. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/dashboard";
}

export function LoginForm() {
  const { t, locale, setLocale } = useTranslation();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get("error") ? t("auth.callbackFailed") : null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const next = safeNext(params.get("next"));
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // Used by the signup trigger only when the account is first created.
        data: { role, preferred_language: locale, display_name: displayName.trim() || undefined },
      },
    });
    setPending(false);
    if (err) setError(err.message);
    else setSentTo(email.trim());
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-indigo-700">{t("app.name")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("app.tagline")}</p>
        </div>
        <Card>
          {sentTo ? (
            <div className="space-y-2 text-center">
              <h2 className="text-lg font-semibold">{t("auth.checkEmail")}</h2>
              <p className="text-sm text-slate-600">{t("auth.checkEmailBody", { email: sentTo })}</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{t("auth.title")}</h2>
                <p className="text-sm text-slate-500">{t("auth.subtitle")}</p>
              </div>
              {error && <Alert>{error}</Alert>}
              <Field label={t("auth.email")}>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </Field>
              <Field label={t("auth.displayName")}>
                <input value={displayName} maxLength={120} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
              </Field>
              <Field label={t("auth.iAm")} hint={t("auth.newHint")}>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputClass}>
                  <option value="student">{t("profile.student")}</option>
                  <option value="professional">{t("profile.professional")}</option>
                </select>
              </Field>
              <Field label={t("profile.language")}>
                <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} className={inputClass}>
                  {SUPPORTED_LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {t(`profile.languages.${l}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? t("auth.sending") : t("auth.sendLink")}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
