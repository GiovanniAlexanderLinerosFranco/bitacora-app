import type { Metadata } from "next";
import { getMessages } from "../locales";
import { publicEnv } from "./env";
import { publicLocalePath } from "./public-locale";
import { LOCALES, type Locale } from "../types";

const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  es: "es_ES",
  pt: "pt_PT",
  fr: "fr_FR",
  de: "de_DE",
  it: "it_IT",
  ru: "ru_RU",
  zh: "zh_CN",
  ja: "ja_JP",
  ko: "ko_KR",
  hi: "hi_IN",
  ar: "ar_AR",
};

export function absoluteUrl(path: string): string {
  const base = publicEnv.appUrl().replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function languageAlternates(): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((locale) => [locale, absoluteUrl(publicLocalePath(locale))])),
    "x-default": absoluteUrl("/"),
  };
}

/** Indexable metadata for one public landing locale. The copy comes from that locale's dictionary. */
export function landingMetadata(locale: Locale): Metadata {
  const messages = getMessages(locale);
  const title = messages.landing.heroTitle;
  const description = messages.landing.heroSubtitle;
  const url = absoluteUrl(publicLocalePath(locale));
  const image = absoluteUrl("/opengraph-image");
  return {
    metadataBase: new URL(publicEnv.appUrl()),
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates() },
    openGraph: {
      title,
      description,
      url,
      siteName: messages.app.name,
      locale: OG_LOCALE[locale],
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: messages.app.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: { index: true, follow: true },
  };
}
