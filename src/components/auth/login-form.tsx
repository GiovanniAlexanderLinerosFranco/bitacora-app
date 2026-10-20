"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { authErrorKey, EMAIL_RE, safeNext } from "../../lib/auth-utils";
import { createClient } from "../../lib/supabase/client";
import { useTranslation } from "../../providers/i18n-provider";
import { Alert, Button, Field, inputClass } from "../ui";
import { AuthShell } from "./auth-shell";

export function LoginForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? t("auth.callbackFailed") : null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t("auth.errors.invalidEmail"));
    setPending(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) {
      setPending(false);
      const key = authErrorKey(err);
      if (key === "auth.errors.emailNotConfirmed") return router.push(`/verify?email=${encodeURIComponent(email.trim())}`);
      return setError(key ? t(key) : err.message);
    }
    router.replace(safeNext(params.get("next")));
    router.refresh();
  }

  return (
    <AuthShell title="auth.loginTitle" subtitle="auth.loginSubtitle">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label={t("auth.email")}>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label={t("auth.password")}>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <div className="text-end text-sm">
          <Link href="/recovery" className="text-indigo-600 hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
        <p className="text-center text-sm text-slate-600">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:underline">
            {t("auth.createAccount")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
