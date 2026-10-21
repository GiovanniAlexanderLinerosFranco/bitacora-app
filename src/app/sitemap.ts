import type { MetadataRoute } from "next";
import { absoluteUrl, languageAlternates } from "../lib/seo";
import { publicLocalePath } from "../lib/public-locale";
import { LOCALES } from "../types";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const languages = languageAlternates();
  const landings: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    ...LOCALES.map((locale) => ({
      url: absoluteUrl(publicLocalePath(locale)),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
      alternates: { languages },
    })),
  ];
  const pages: MetadataRoute.Sitemap = ["/pricing", "/terms", "/privacy"].map((path) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
  return [...landings, ...pages];
}
