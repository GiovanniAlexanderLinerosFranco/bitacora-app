import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingView } from "../../../components/landing/landing-view";
import { isLocale } from "../../../lib/public-locale";
import { landingMetadata } from "../../../lib/seo";
import { LOCALES } from "../../../types";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return landingMetadata(locale);
}

export default async function LocalizedLandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LandingView locale={locale} />;
}
