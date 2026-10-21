import type { Metadata } from "next";
import { LandingView } from "../../components/landing/landing-view";
import { resolvePublicLocale } from "../../lib/request-locale";
import { landingMetadata } from "../../lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return landingMetadata(await resolvePublicLocale());
}

export default async function LandingPage() {
  return <LandingView locale={await resolvePublicLocale()} />;
}
