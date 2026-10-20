"use client";

import Link from "next/link";
import { useState } from "react";
import type { TranslationKey } from "../../lib/i18n";
import { useTranslation } from "../../providers/i18n-provider";
import { LanguageSwitcher } from "../layout/language-switcher";
import { Button, Modal } from "../ui";

type PlanId = "free" | "pro" | "team";

// Placeholder list prices in USD; adjust before enabling real billing.
const PRO_PRICE = { monthly: 8, yearly: 80 } as const;

const PLANS: { id: PlanId; features: TranslationKey[]; highlight?: boolean }[] = [
  {
    id: "free",
    features: ["pricing.freeF1", "pricing.freeF2", "pricing.freeF3", "pricing.freeF4", "pricing.freeF5"],
  },
  {
    id: "pro",
    highlight: true,
    features: ["pricing.proF1", "pricing.proF2", "pricing.proF3", "pricing.proF4", "pricing.proF5", "pricing.proF6"],
  },
  {
    id: "team",
    features: ["pricing.teamF1", "pricing.teamF2", "pricing.teamF3", "pricing.teamF4", "pricing.teamF5"],
  },
];

const NAME: Record<PlanId, TranslationKey> = { free: "pricing.freeName", pro: "pricing.proName", team: "pricing.teamName" };
const AUDIENCE: Record<PlanId, TranslationKey> = {
  free: "pricing.freeAudience",
  pro: "pricing.proAudience",
  team: "pricing.teamAudience",
};
const CTA: Record<PlanId, TranslationKey> = { free: "pricing.freeCta", pro: "pricing.proCta", team: "pricing.teamCta" };

export function PricingView() {
  const { t } = useTranslation();
  const [yearly, setYearly] = useState(false);
  const [modal, setModal] = useState<Exclude<PlanId, "free"> | null>(null);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  const price = (id: PlanId) => {
    if (id === "team") return { amount: t("pricing.custom"), unit: null, note: t("pricing.customNote") };
    const value = id === "free" ? 0 : yearly ? PRO_PRICE.yearly : PRO_PRICE.monthly;
    const unit = id === "free" ? null : yearly ? t("pricing.perYear") : t("pricing.perMonth");
    return { amount: `$${value}`, unit, note: null };
  };

  const mailto = (plan: "pro" | "team") =>
    `mailto:${supportEmail}?subject=${encodeURIComponent(t(plan === "pro" ? "pricing.mailSubjectPro" : "pricing.mailSubjectTeam"))}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-indigo-700">
          {t("app.name")}
        </Link>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-indigo-700">
            {t("landing.ctaSignIn")}
          </Link>
        </div>
      </div>

      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{t("pricing.title")}</h1>
        <p className="mt-3 text-slate-600">{t("pricing.subtitle")}</p>
        <div role="group" aria-label={t("pricing.nav")} className="mt-6 inline-flex rounded-full border border-slate-300 bg-white p-1 text-sm">
          {([false, true] as const).map((isYearly) => (
            <button
              key={String(isYearly)}
              type="button"
              aria-pressed={yearly === isYearly}
              onClick={() => setYearly(isYearly)}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${yearly === isYearly ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {t(isYearly ? "pricing.yearly" : "pricing.monthly")}
              {isYearly && <span className={`ms-2 text-xs ${yearly ? "text-indigo-100" : "text-emerald-600"}`}>{t("pricing.yearlySave")}</span>}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PLANS.map(({ id, features, highlight }) => {
          const p = price(id);
          return (
            <section
              key={id}
              aria-labelledby={`plan-${id}`}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${highlight ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"}`}
            >
              {highlight && (
                <span className="absolute -top-3 start-6 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">{t("pricing.mostPopular")}</span>
              )}
              <h2 id={`plan-${id}`} className="text-xl font-bold text-slate-900">
                {t(NAME[id])}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{t(AUDIENCE[id])}</p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">{p.amount}</span>
                {p.unit && <span className="text-sm text-slate-500">{p.unit}</span>}
              </p>
              <p className="mt-1 h-5 text-xs text-slate-500">{p.note}</p>
              <ul className="my-6 flex-1 space-y-2.5 text-sm text-slate-700">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span aria-hidden className="mt-0.5 text-emerald-600">
                      ✓
                    </span>
                    <span>{t(f)}</span>
                  </li>
                ))}
              </ul>
              {id === "free" ? (
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {t(CTA[id])}
                </Link>
              ) : (
                <Button variant={highlight ? "primary" : "secondary"} className="w-full py-2.5" onClick={() => setModal(id)}>
                  {t(CTA[id])}
                </Button>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">{t("pricing.footnote")}</p>

      {modal && (
        <Modal title={t(modal === "pro" ? "pricing.modalProTitle" : "pricing.modalTeamTitle")} onClose={() => setModal(null)}>
          <p className="text-sm text-slate-700">{t(modal === "pro" ? "pricing.modalProBody" : "pricing.modalTeamBody")}</p>
          {supportEmail && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={mailto(modal)}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                {t("pricing.requestByEmail")}
              </a>
              <span className="text-sm text-slate-500" dir="ltr">
                {supportEmail}
              </span>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
