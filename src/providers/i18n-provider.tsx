"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, resolveLocale } from "../locales";
import { formatDate, translate, type TranslationKey, type TranslationParams } from "../lib/i18n";
import type { Locale } from "../types";
import { useAuth } from "./auth-provider";

interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  formatDate: (date: string) => string;
  /** Only affects signed-out screens; signed-in users follow profile.preferredLanguage. */
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const { profile } = useAuth();
  const [fallback, setFallback] = useState<Locale>(initialLocale);
  const locale = profile ? resolveLocale(profile.preferredLanguage) : fallback;
  const messages = dictionaries[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: TranslationKey, params?: TranslationParams) => translate(messages, key, params), [messages]);
  const format = useCallback((date: string) => formatDate(date, locale), [locale]);

  const value = useMemo<I18nContextValue>(() => ({ locale, t, formatDate: format, setLocale: setFallback }), [locale, t, format]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within <I18nProvider>");
  return ctx;
}
