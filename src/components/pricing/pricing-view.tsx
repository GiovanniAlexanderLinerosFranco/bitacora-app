"use client";

import Link from "next/link";
import { useState } from "react";
import { createCheckoutSession, createCustomerPortalSession, type BillingSnapshot } from "../../actions/stripe";
import { createWompiCheckoutSession } from "../../actions/wompi";
import { describeError } from "../../lib/action-error";
import type { TranslationKey } from "../../lib/i18n";
import { useTranslation } from "../../providers/i18n-provider";
import { LanguageSwitcher } from "../layout/language-switcher";
import { Alert, Button, Modal } from "../ui";
import { openWompiWidget } from "./wompi-widget";

type PlanId = "free" | "pro" | "team";

// Advertised list prices in USD. Checkout charges STRIPE_PRO_PRICE_ID, the price configured in Stripe.
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

export function PricingView({ billing, notice }: { billing: BillingSnapshot; notice: "success" | "canceled" | "wompi" | null }) {
  const { t } = useTranslation();
  const [yearly, setYearly] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [pending, setPending] = useState<"checkout" | "portal" | "wompi" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const proActive = billing.proAccess;
  const proPastDue = billing.subscriptionStatus === "past_due" && billing.canManagePortal;

  const price = (id: PlanId) => {
    if (id === "team") return { amount: t("pricing.custom"), unit: null, note: t("pricing.customNote") };
    const value = id === "free" ? 0 : yearly ? PRO_PRICE.yearly : PRO_PRICE.monthly;
    const unit = id === "free" ? null : yearly ? t("pricing.perYear") : t("pricing.perMonth");
    return { amount: `$${value}`, unit, note: null };
  };

  const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(t("pricing.mailSubjectTeam"))}`;

  async function startBilling(kind: "checkout" | "portal") {
    setPending(kind);
    setError(null);
    const result = kind === "checkout" ? await createCheckoutSession() : await createCustomerPortalSession();
    if (result.error || !result.data) {
      setError(describeError(result.error ?? { code: "billing_unavailable", message: t("pricing.billingUnavailable") }, t));
      setPending(null);
      return;
    }
    window.location.assign(result.data.url);
  }

  async function startWompi() {
    setPending("wompi");
    setError(null);
    const result = await createWompiCheckoutSession();
    if (result.error || !result.data) {
      setError(describeError(result.error ?? { code: "billing_unavailable", message: t("pricing.billingUnavailable") }, t));
      setPending(null);
      return;
    }
    try {
      await openWompiWidget(result.data);
      setInfo(t("pricing.wompiPending"));
    } catch {
      setError(t("pricing.billingUnavailable"));
    } finally {
      setPending(null);
    }
  }

  const payButtons = billing.signedIn ? (
    <div className="flex flex-col gap-2">
      <Button className="w-full py-2.5" disabled={pending !== null} onClick={() => void startWompi()}>
        {pending === "wompi" ? t("common.loading") : t("pricing.wompiCta")}
      </Button>
      <Button variant="secondary" className="w-full py-2.5" disabled={pending !== null} onClick={() => void startBilling("checkout")}>
        {pending === "checkout" ? t("common.loading") : t("pricing.stripeCta")}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col gap-2">
      <Link href="/login?next=/pricing" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
        {t("pricing.wompiCta")}
      </Link>
      <Link href="/login?next=/pricing" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
        {t("pricing.stripeCta")}
      </Link>
    </div>
  );

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
        {notice === "success" && <div className="mt-4"><Alert tone="success">{t("pricing.checkoutSuccess")}</Alert></div>}
        {notice === "canceled" && <div className="mt-4"><Alert tone="info">{t("pricing.checkoutCanceled")}</Alert></div>}
        {(notice === "wompi" || info) && <div className="mt-4"><Alert tone="info">{info ?? t("pricing.wompiPending")}</Alert></div>}
        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
        {proActive && <p className="mt-4 text-sm font-medium text-emerald-700">{t("pricing.proActive")}</p>}
        {proPastDue && <p className="mt-4 text-sm font-medium text-amber-700">{t("pricing.pastDue")}</p>}
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
              ) : id === "team" ? (
                <Button variant="secondary" className="w-full py-2.5" onClick={() => setTeamOpen(true)}>
                  {t(CTA[id])}
                </Button>
              ) : proActive && billing.canManagePortal ? (
                <Button className="w-full py-2.5" disabled={pending !== null} onClick={() => void startBilling("portal")}>
                  {pending === "portal" ? t("common.loading") : t("pricing.manageCta")}
                </Button>
              ) : proActive ? null : proPastDue && billing.canManagePortal ? (
                <Button className="w-full py-2.5" disabled={pending !== null} onClick={() => void startBilling("portal")}>
                  {pending === "portal" ? t("common.loading") : t("pricing.manageCta")}
                </Button>
              ) : (
                payButtons
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">{t("pricing.footnote")}</p>

      {teamOpen && (
        <Modal title={t("pricing.modalTeamTitle")} onClose={() => setTeamOpen(false)}>
          <p className="text-sm text-slate-700">{t("pricing.modalTeamBody")}</p>
          {supportEmail && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                href={mailto}
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
