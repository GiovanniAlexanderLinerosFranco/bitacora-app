"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { authErrorKey, passwordError } from "../../lib/auth-utils";
import { createClient } from "../../lib/supabase/client";
import { useTranslation } from "../../providers/i18n-provider";
import { Alert, Button, Field, inputClass } from "../ui";
import { AuthShell } from "./auth-shell";

export function UpdatePasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  // The reset link signs the user in through /auth/callback; without that session the form is unusable.
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setHasSession(Boolean(data.user)));
  }, [supabase]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pwKey = passwordError(password);
    if (pwKey) return setError(t(pwKey));
    if (password !== confirm) return setError(t("auth.errors.passwordMismatch"));
    setPending(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setPending(false);
      const key = authErrorKey(err);
      return setError(key ? t(key) : err.message);
    }
    setDone(true);
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell title="auth.updateTitle">
      {hasSession === false ? (
        <div className="space-y-4">
          <Alert>{t("auth.resetLinkInvalid")}</Alert>
          <Link href="/recovery" className="block text-center text-sm text-indigo-600 hover:underline">
            {t("auth.recoveryTitle")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          {done && <Alert tone="success">{t("auth.passwordUpdated")}</Alert>}
          <Field label={t("auth.newPassword")} hint={t("auth.passwordRules")}>
            <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("auth.confirmPassword")}>
            <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </Field>
          <Button type="submit" className="w-full" disabled={pending || hasSession === null}>
            {pending ? t("auth.updating") : t("auth.updatePassword")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
