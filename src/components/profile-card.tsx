"use client";

import { useState, type FormEvent } from "react";
import { updateProfile as updateProfileAction } from "../actions/profile";
import { describeError } from "../lib/action-error";
import { SUPPORTED_LOCALES } from "../locales";
import { useAuth } from "../providers/auth-provider";
import { useTranslation } from "../providers/i18n-provider";
import type { UserProfile, UserRole } from "../types";
import { Alert, Button, Card, Field, inputClass } from "./ui";

function ProfileForm({ profile, onSaved }: { profile: UserProfile; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [role, setRole] = useState<UserRole>(profile.role);
  const [academicLevel, setAcademicLevel] = useState(profile.academicLevel ?? "");
  const [careerOrField, setCareerOrField] = useState(profile.careerOrField ?? "");
  const [language, setLanguage] = useState(profile.preferredLanguage);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await updateProfileAction({
      displayName,
      role,
      academicLevel,
      careerOrField,
      preferredLanguage: language,
      timezone,
    });
    if (res.error) setError(describeError(res.error, t));
    else {
      await onSaved();
      setSaved(true);
    }
    setPending(false);
  }

  const timezones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {!profile.careerOrField && (
        <div className="sm:col-span-2">
          <Alert tone="info">{t("profile.onboarding")}</Alert>
        </div>
      )}
      <Field label={t("profile.displayName")}>
        <input value={displayName} maxLength={120} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t("profile.role")}>
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputClass}>
          <option value="student">{t("profile.student")}</option>
          <option value="professional">{t("profile.professional")}</option>
        </select>
      </Field>
      {role === "student" && (
        <Field label={t("profile.academicLevel")}>
          <input
            value={academicLevel}
            maxLength={120}
            placeholder={t("profile.academicLevelPlaceholder")}
            onChange={(e) => setAcademicLevel(e.target.value)}
            className={inputClass}
          />
        </Field>
      )}
      <Field label={t("profile.career")}>
        <input
          value={careerOrField}
          maxLength={160}
          placeholder={t("profile.careerPlaceholder")}
          onChange={(e) => setCareerOrField(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label={t("profile.language")}>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l}>
              {t(`profile.languages.${l}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("profile.timezone")}>
        <input value={timezone} list="timezones" onChange={(e) => setTimezone(e.target.value)} className={inputClass} />
        <datalist id="timezones">
          {timezones.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        {saved && <span className="text-sm text-emerald-600">{t("profile.saved")}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

export function ProfileCard() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  return (
    <Card title={t("profile.title")} description={t("profile.subtitle")}>
      {profile ? (
        // key re-initialises the form whenever the saved profile changes
        <ProfileForm key={profile.updatedAt} profile={profile} onSaved={refreshProfile} />
      ) : (
        <p className="text-sm text-slate-500">{t("common.loading")}</p>
      )}
    </Card>
  );
}
