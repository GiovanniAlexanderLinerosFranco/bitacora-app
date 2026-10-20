import ar from "./ar.json";
import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import hi from "./hi.json";
import it from "./it.json";
import ja from "./ja.json";
import ko from "./ko.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";
import { LOCALES, RTL_LOCALES, type Locale } from "../types";

export type Messages = typeof en;

// Add a language: create <code>.json with the same shape, import it here, and add the code to `LOCALES`.
export const dictionaries: Record<Locale, Messages> = { en, es, pt, fr, de, it, ru, zh, ja, ko, hi, ar };
export const SUPPORTED_LOCALES: readonly Locale[] = LOCALES;
export const DEFAULT_LOCALE: Locale = "en";

/** Picks the first supported language from an Accept-Language header, in priority order. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  for (const part of (header ?? "").split(",")) {
    const code = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    const match = SUPPORTED_LOCALES.find((l) => l === code);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

export const dirFor = (locale: Locale): "rtl" | "ltr" => (RTL_LOCALES.includes(locale) ? "rtl" : "ltr");

export function resolveLocale(value: string | null | undefined): Locale {
  const code = value?.slice(0, 2).toLowerCase();
  return SUPPORTED_LOCALES.find((l) => l === code) ?? DEFAULT_LOCALE;
}

export function getMessages(locale: string | null | undefined): Messages {
  return dictionaries[resolveLocale(locale)];
}
