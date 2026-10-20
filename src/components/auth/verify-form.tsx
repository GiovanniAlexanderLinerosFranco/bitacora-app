"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { authErrorKey, EMAIL_RE } from "../../lib/auth-utils";
import { createClient } from "../../lib/supabase/client";
import { useTranslation } from "../../providers/i18n-provider";
import { Alert, Button, Field, inputClass } from "../ui";
import { AuthShell } from "./auth-shell";

export function VerifyForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t("auth.errors.invalidEmail"));
    setPending(true);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "signup" });
    if (err) {
      setPending(false);
      const key = authErrorKey(err);
      return setError(key ? t(key) : t("auth.errors.codeInvalid"));
    }
    setInfo(t("auth.verified"));
    router.replace("/dashboard");
    router.refresh();
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t("auth.errors.invalidEmail"));
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      const key = authErrorKey(err);
      setError(key ? t(key) : err.message);
    } else setInfo(t("auth.resent"));
  }

  return (
    <AuthShell title="auth.verifyTitle">
      <form onSubmit={onVerify} className="space-y-4" noValidate>
        <p className="text-sm text-slate-600">{t("auth.verifyBody", { email: email || "…" })}</p>
        {error && <Alert>{error}</Alert>}
        {info && <Alert tone="success">{info}</Alert>}
        {!params.get("email") && (
          <Field label={t("auth.email")}>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
        )}
        <Field label={t("auth.codeLabel")}>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${inputClass} text-center text-lg tracking-widest`}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending || code.length < 6}>
          {pending ? t("auth.verifying") : t("auth.verify")}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={onResend} className="text-indigo-600 hover:underline">
            {t("auth.resend")}
          </button>
          <Link href="/login" className="text-slate-600 hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
