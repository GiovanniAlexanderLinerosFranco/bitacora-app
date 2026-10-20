"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, dirFor, resolveLocale } from "../locales";
import { formatDate, translate, type TranslationKey, type TranslationParams } from "../lib/i18n";
import { LOCALE_COOKIE, type Locale } from "../types";
import { useAuth } from "./auth-provider";

interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  formatDate: (date: string) => string;
  /** Signed-in users follow their profile; the switcher updates both the profile and the cookie. */
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const [fallback, setFallback] = useState<Locale>(initialLocale);
  const locale = profile ? resolveLocale(profile.preferredLanguage) : fallback;
  const messages = dictionaries[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      setFallback(next);
      if (profile) void updateProfile({ preferredLanguage: next });
    },
    [profile, updateProfile],
  );

  const t = useCallback((key: TranslationKey, params?: TranslationParams) => translate(messages, key, params), [messages]);
  const format = useCallback((date: string) => formatDate(date, locale), [locale]);

  const value = useMemo<I18nContextValue>(() => ({ locale, t, formatDate: format, setLocale }), [locale, t, format, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used within <I18nProvider>");
  return ctx;
}
