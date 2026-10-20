"use client";

import Link from "next/link";
import { useTranslation } from "../../providers/i18n-provider";
import type { TranslationKey } from "../../lib/i18n";
import { LanguageSwitcher } from "../layout/language-switcher";

const N = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
// Bump when the legal text changes materially.
const LAST_UPDATED = "2025-01-01";

/** Renders the Terms (kind="terms") or the Privacy Policy (kind="privacy") from the active dictionary. */
export function LegalDocument({ kind }: { kind: "terms" | "privacy" }) {
  const { t, formatDate } = useTranslation();
  const prefix = kind === "terms" ? "t" : "p";
  const contact = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const key = (n: number, part: "Title" | "Body") => `legal.${prefix}${n}${part}` as TranslationKey;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← {t("legal.backHome")}
        </Link>
        <LanguageSwitcher />
      </div>
      <article className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">{t(kind === "terms" ? "legal.terms" : "legal.privacy")}</h1>
          <p className="text-xs text-slate-500">{t("legal.lastUpdated", { date: formatDate(LAST_UPDATED) })}</p>
          <p className="text-sm text-slate-700">{t(kind === "terms" ? "legal.termsIntro" : "legal.privacyIntro")}</p>
        </header>
        {N.map((n) => (
          <section key={n} className={kind === "privacy" && n === 1 ? "rounded-lg bg-indigo-50 p-4" : undefined}>
            <h2 className="mb-1 font-semibold">{t(key(n, "Title"))}</h2>
            <p className="text-sm leading-relaxed text-slate-700">{t(key(n, "Body"))}</p>
          </section>
        ))}
        {contact && <p className="text-sm text-slate-700">{t("legal.contact", { email: contact })}</p>}
        <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">{t("legal.disclaimer")}</p>
      </article>
      <p className="mt-4 text-center text-xs text-slate-500">
        <Link href={kind === "terms" ? "/privacy" : "/terms"} className="hover:underline">
          {t(kind === "terms" ? "legal.privacy" : "legal.terms")}
        </Link>
      </p>
    </div>
  );
}
