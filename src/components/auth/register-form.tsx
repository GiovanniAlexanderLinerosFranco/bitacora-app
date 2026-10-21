"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, type FormEvent } from "react";
import { authErrorKey, EMAIL_RE, passwordError } from "../../lib/auth-utils";
import { createClient } from "../../lib/supabase/client";
import { useTranslation } from "../../providers/i18n-provider";
import type { UserRole } from "../../types";
import { Alert, Button, Field, inputClass } from "../ui";
import { AuthShell } from "./auth-shell";

/** Renders a translated sentence containing {terms} / {privacy} placeholders as links, whatever the word order. */
function AcceptText() {
  const { t } = useTranslation();
  const link = (href: string, label: string) => (
    <Link href={href} target="_blank" className="text-indigo-600 hover:underline">
      {label}
    </Link>
  );
  return (
    <>
      {t("auth.acceptTerms")
        .split(/(\{terms\}|\{privacy\})/)
        .map((part, i) => (
          <Fragment key={i}>
            {part === "{terms}" ? link("/terms", t("legal.terms")) : part === "{privacy}" ? link("/privacy", t("legal.privacy")) : part}
          </Fragment>
        ))}
    </>
  );
}

export function RegisterForm() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanEmail = email.trim();
    const pwKey = passwordError(password);
    if (displayName.trim().length < 2) return setError(t("auth.errors.nameTooShort"));
    if (!EMAIL_RE.test(cleanEmail)) return setError(t("auth.errors.invalidEmail"));
    if (pwKey) return setError(t(pwKey));
    if (password !== confirm) return setError(t("auth.errors.passwordMismatch"));
    if (!accepted || !ageOk) return setError(t("auth.errors.mustAccept"));

    setPending(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        // Read by the signup trigger to create the profile row.
        data: { display_name: displayName.trim(), role, preferred_language: locale, accepted_terms_at: new Date().toISOString() },
      },
    });
    if (err) {
      setPending(false);
      const key = authErrorKey(err);
      return setError(key ? t(key) : err.message);
    }
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
    } else {
      router.replace(`/verify?email=${encodeURIComponent(cleanEmail)}`);
    }
  }

  return (
    <AuthShell title="auth.registerTitle" subtitle="auth.registerSubtitle">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label={t("auth.displayName")}>
          <input required maxLength={120} autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t("auth.email")}>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t("auth.iAm")}>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputClass}>
            <option value="student">{t("profile.student")}</option>
            <option value="professional">{t("profile.professional")}</option>
          </select>
        </Field>
        <Field label={t("auth.password")} hint={t("auth.passwordRules")}>
          <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t("auth.confirmPassword")}>
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
          <span>
            <AcceptText />
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} className="mt-1" />
          <span>{t("auth.ageConfirm")}</span>
        </label>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("auth.creating") : t("auth.createAccount")}
        </Button>
        <p className="text-center text-sm text-slate-600">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            {t("auth.signIn")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
