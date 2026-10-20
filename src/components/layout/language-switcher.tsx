"use client";

import { SUPPORTED_LOCALES } from "../../locales";
import { useTranslation } from "../../providers/i18n-provider";
import type { Locale } from "../../types";

const NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ru: "Русский",
  zh: "简体中文",
  ja: "日本語",
  ko: "한국어",
  hi: "हिन्दी",
  ar: "العربية",
};

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useTranslation();
  return (
    <select
      aria-label={t("profile.language")}
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={`rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none ${className}`}
    >
      {SUPPORTED_LOCALES.map((l) => (
        <option key={l} value={l}>
          {NATIVE_NAMES[l]}
        </option>
      ))}
    </select>
  );
}
