"use client";

import Link from "next/link";
import { useTranslation } from "../../providers/i18n-provider";
import type { TranslationKey } from "../../lib/i18n";

const FEATURES: { title: TranslationKey; body: TranslationKey; icon: string }[] = [
  { title: "landing.f1Title", body: "landing.f1Body", icon: "📚" },
  { title: "landing.f2Title", body: "landing.f2Body", icon: "📝" },
  { title: "landing.f3Title", body: "landing.f3Body", icon: "🎓" },
  { title: "landing.f4Title", body: "landing.f4Body", icon: "🌍" },
];

const STEPS: TranslationKey[] = ["landing.how1", "landing.how2", "landing.how3"];

const primary =
  "rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500";
const secondary =
  "rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50";

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold text-indigo-700">{t("app.name")}</span>
        <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-indigo-700">
          {t("landing.ctaSignIn")}
        </Link>
      </header>

      <section className="py-20 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{t("landing.heroSubtitle")}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/login" className={primary}>
            {t("landing.ctaStart")}
          </Link>
          <Link href="/login" className={secondary}>
            {t("landing.ctaSignIn")}
          </Link>
        </div>
      </section>

      <section aria-labelledby="features">
        <h2 id="features" className="mb-8 text-center text-2xl font-bold text-slate-900">
          {t("landing.featuresTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-2xl" aria-hidden>
                {f.icon}
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900">{t(f.title)}</h3>
              <p className="mt-2 text-sm text-slate-600">{t(f.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-16" aria-labelledby="how">
        <h2 id="how" className="mb-8 text-center text-2xl font-bold text-slate-900">
          {t("landing.howTitle")}
        </h2>
        <ol className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="rounded-xl bg-indigo-50 p-5 text-sm text-slate-700">
              <span className="mb-2 block text-2xl font-bold text-indigo-600">{i + 1}</span>
              {t(s)}
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-auto border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        {t("landing.footer")}
      </footer>
    </main>
  );
}
