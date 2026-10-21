"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding, updateProfile } from "../../actions/profile";
import { createSubject } from "../../actions/subjects";
import { createLedgerEntry } from "../../actions/ledger";
import { uploadEntryAttachment } from "../../actions/attachments";
import { recordSignUp } from "../../actions/telemetry";
import { describeError } from "../../lib/action-error";
import { ALLOWED_MIME_TYPES } from "../../lib/attachments";
import { useAuth } from "../../providers/auth-provider";
import { useTranslation } from "../../providers/i18n-provider";
import type { UserRole } from "../../types";
import { Alert, Button, Field, inputClass } from "../ui";

export function OnboardingWizard() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole>(profile?.role ?? "student");
  const [field, setField] = useState(profile?.careerOrField ?? "");
  const [subjectName, setSubjectName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void recordSignUp();
  }, []);

  async function finish() {
    const done = await completeOnboarding();
    if (done.error) {
      setError(describeError(done.error, t));
      setPending(false);
      return;
    }
    await refreshProfile();
    router.replace("/dashboard");
    router.refresh();
  }

  async function onRole(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const res = await updateProfile({ role });
    setPending(false);
    if (res.error) return setError(describeError(res.error, t));
    setStep(2);
  }

  async function onField(event: FormEvent) {
    event.preventDefault();
    const area = field.trim();
    const subject = subjectName.trim();
    if (area.length < 2 || subject.length < 1) return setError(t("onboarding.fieldRequired"));
    setPending(true);
    setError(null);
    const profileRes = await updateProfile({ careerOrField: area });
    if (profileRes.error) {
      setPending(false);
      return setError(describeError(profileRes.error, t));
    }
    const subjectRes = await createSubject({ name: subject, kind: "subject" });
    setPending(false);
    if (subjectRes.error) return setError(describeError(subjectRes.error, t));
    setStep(3);
  }

  async function onNote(event: FormEvent) {
    event.preventDefault();
    const noteTitle = title.trim();
    if (noteTitle.length < 1) return setError(t("onboarding.noteRequired"));
    setPending(true);
    setError(null);
    const created = await createLedgerEntry({
      title: noteTitle,
      entryType: role === "professional" ? "meeting" : "class_note",
      rawText: body,
    });
    if (created.error) {
      setPending(false);
      return setError(describeError(created.error, t));
    }
    if (file) {
      const form = new FormData();
      form.set("file", file);
      const uploaded = await uploadEntryAttachment(created.data.id, form);
      if (uploaded.error) {
        setError(t("ledger.uploadWarning", { reason: describeError(uploaded.error, t) }));
        setPending(false);
        await finish();
        return;
      }
    }
    await finish();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">{t("onboarding.step", { current: step, total: 3 })}</p>
        <h1 className="mt-1 text-2xl font-bold">{t("onboarding.title")}</h1>
      </div>
      {error && <Alert>{error}</Alert>}

      {step === 1 && (
        <form onSubmit={onRole} className="space-y-4">
          <h2 className="text-lg font-semibold">{t("onboarding.roleTitle")}</h2>
          <p className="text-sm text-slate-600">{t("onboarding.roleHint")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["student", "professional"] as const).map((option) => (
              <label key={option} className={`cursor-pointer rounded-xl border p-4 ${role === option ? "border-indigo-600 bg-indigo-50" : "border-slate-200 bg-white"}`}>
                <input type="radio" name="role" className="sr-only" checked={role === option} onChange={() => setRole(option)} />
                <span className="block font-semibold">{t(option === "student" ? "onboarding.student" : "onboarding.professional")}</span>
                <span className="mt-1 block text-sm text-slate-600">{t(option === "student" ? "onboarding.studentBody" : "onboarding.professionalBody")}</span>
              </label>
            ))}
          </div>
          <Button type="submit" disabled={pending}>{pending ? t("onboarding.saving") : t("onboarding.next")}</Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={onField} className="space-y-4">
          <h2 className="text-lg font-semibold">{t("onboarding.fieldTitle")}</h2>
          <Field label={t("onboarding.fieldLabel")}>
            <input value={field} onChange={(e) => setField(e.target.value)} placeholder={t("onboarding.fieldPlaceholder")} className={inputClass} maxLength={160} required />
          </Field>
          <Field label={t("onboarding.subjectLabel")}>
            <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder={t("onboarding.subjectPlaceholder")} className={inputClass} maxLength={200} required />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(1)} disabled={pending}>{t("onboarding.back")}</Button>
            <Button type="submit" disabled={pending}>{pending ? t("onboarding.saving") : t("onboarding.next")}</Button>
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={onNote} className="space-y-4">
          <h2 className="text-lg font-semibold">{t("onboarding.noteTitle")}</h2>
          <p className="text-sm text-slate-600">{t("onboarding.noteHint")}</p>
          <Field label={t("onboarding.noteTitleLabel")}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} maxLength={300} required />
          </Field>
          <Field label={t("onboarding.noteBodyLabel")}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} min-h-32`} maxLength={200000} />
          </Field>
          <Field label={t("onboarding.fileLabel")}>
            <input type="file" accept={ALLOWED_MIME_TYPES.join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setStep(2)} disabled={pending}>{t("onboarding.back")}</Button>
            <Button type="submit" disabled={pending}>{pending ? t("onboarding.saving") : t("onboarding.finish")}</Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setPending(true);
                setError(null);
                void finish();
              }}
            >
              {t("onboarding.skip")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
