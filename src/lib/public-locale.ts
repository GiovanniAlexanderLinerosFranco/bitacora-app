import { LOCALES, type Locale } from "../types";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Public acquisition URL: exactly one segment that is a supported locale, such as `/es`. */
export function localeFromPathname(pathname: string): Locale | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const code = segments[0]?.toLowerCase() ?? "";
  return isLocale(code) ? code : null;
}

export function publicLocalePath(locale: Locale): string {
  return `/${locale}`;
}
