import { cookies, headers } from "next/headers";
import { localeFromAcceptLanguage, resolveLocale } from "../locales";
import { LOCALE_COOKIE, type Locale } from "../types";

/** Locale for the negotiated landing at `/`: cookie first, then the browser language. */
export async function resolvePublicLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (saved) return resolveLocale(saved);
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}
