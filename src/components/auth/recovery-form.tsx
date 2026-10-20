"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { authErrorKey, EMAIL_RE } from "../../lib/auth-utils";
import { createClient } from "../../lib/supabase/client";
import { useTranslation } from "../../providers/i18n-provider";
import { Alert, Button, Field, inputClass } from "../ui";
import { AuthShell } from "./auth-shell";

export function RecoveryForm() {
  const { t } = useTranslation();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t("auth.errors.invalidEmail"));
    setPending(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    setPending(false);
    if (err) {
      const key = authErrorKey(err);
      return setError(key ? t(key) : err.message);
    }
    setSentTo(email.trim());
  }

  return (
    <AuthShell title="auth.recoveryTitle" subtitle="auth.recoverySubtitle">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        {sentTo && <Alert tone="success">{t("auth.recoverySent", { email: sentTo })}</Alert>}
        <Field label={t("auth.email")}>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("auth.sending") : t("auth.sendReset")}
        </Button>
        <p className="text-center text-sm">
          <Link href="/login" className="text-indigo-600 hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
