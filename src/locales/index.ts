import en from "./en.json";
import es from "./es.json";
import type { Locale } from "../types";

export type Messages = typeof en;

// Add a language: create <code>.json with the same shape, import it here, extend `Locale`.
export const dictionaries: Record<Locale, Messages> = { en, es };
export const SUPPORTED_LOCALES = Object.keys(dictionaries) as Locale[];
export const DEFAULT_LOCALE: Locale = "en";

export function resolveLocale(value: string | null | undefined): Locale {
  const code = value?.slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.find((l) => l === code) ?? DEFAULT_LOCALE;
}

export function getMessages(locale: string | null | undefined): Messages {
  return dictionaries[resolveLocale(locale)];
}
