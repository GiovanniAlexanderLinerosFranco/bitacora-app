import Image from "next/image";
import Link from "next/link";
import { getMessages } from "../../locales";
import { CitationDemo } from "./citation-demo";
import { translate, type TranslationKey } from "../../lib/i18n";
import { publicLocalePath } from "../../lib/public-locale";
import { LOCALES, type Locale } from "../../types";

const NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ru: "Русский",
  zh: "简体中文",
  ja: "日本語",
  ko: "한국어",
  hi: "हिन्दी",
  ar: "العربية",
};

const PILLARS = [
  { title: "landing.f1Title", body: "landing.f1Body" },
  { title: "landing.f2Title", body: "landing.f2Body" },
  { title: "landing.f3Title", body: "landing.f3Body" },
  { title: "landing.f4Title", body: "landing.f4Body" },
] as const;

const ROLES = [
  { title: "landing.role1Title", body: "landing.how1" },
  { title: "landing.role2Title", body: "landing.how2" },
  { title: "landing.role3Title", body: "landing.how3" },
] as const;

const primary = "rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500";
const secondary = "rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50";

/** Public landing. Server-rendered so the title, description and language links are in the first HTML response. */
export function LandingView({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const t = (key: TranslationKey) => translate(messages, key);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-lg font-bold text-indigo-700">{t("app.name")}</span>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="text-sm font-medium text-slate-700 hover:text-indigo-700">
            {t("pricing.nav")}
          </Link>
          <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-indigo-700">
            {t("landing.ctaSignIn")}
          </Link>
        </div>
      </header>

      <nav aria-label={t("profile.language")} className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {LOCALES.map((code) => (
          <a
            key={code}
            href={publicLocalePath(code)}
            hrefLang={code}
            lang={code}
            className={code === locale ? "font-semibold text-indigo-700" : "hover:text-indigo-700"}
            aria-current={code === locale ? "page" : undefined}
          >
            {NATIVE_NAMES[code]}
          </a>
        ))}
      </nav>

      <section className="py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{t("landing.rolesEyebrow")}</p>
        <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{t("landing.heroTitle")}</h1>
        <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-600">{t("landing.heroSubtitle")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/onboarding" className={primary}>
            {t("landing.ctaStart")}
          </Link>
          <Link href="/login" className={secondary}>
            {t("landing.ctaSignIn")}
          </Link>
        </div>
        <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-3xl bg-slate-950 shadow-2xl shadow-indigo-950/25 ring-1 ring-slate-200/80">
          <Image
            src="/landing/landingpage-bitacora-app-01.jpg"
            alt={t("landing.heroImageAlt")}
            width={1408}
            height={768}
            priority
            sizes="(min-width: 1024px) 64rem, 100vw"
            className="h-auto w-full"
          />
        </div>
      </section>

      <section aria-labelledby="pillars">
        <h2 id="pillars" className="mb-8 text-center text-2xl font-bold text-slate-900">
          {t("landing.featuresTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar, index) => (
            <article key={pillar.title} className="rounded-xl border border-slate-200 bg-white p-6">
              <span className="text-sm font-bold text-indigo-600">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{t(pillar.title)}</h3>
              <p className="mt-2 text-sm text-slate-600">{t(pillar.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-16" aria-labelledby="roles">
        <h2 id="roles" className="mb-8 text-center text-2xl font-bold text-slate-900">
          {t("landing.howTitle")}
        </h2>
        <ol className="grid gap-4 lg:grid-cols-3">
          {ROLES.map((role) => (
            <li key={role.title} className="relative rounded-xl border border-slate-200 bg-white p-6">
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{t(role.title)}</span>
              <p className="mt-3 text-sm leading-6 text-slate-700">{t(role.body)}</p>
            </li>
          ))}
        </ol>
      </section>

      <CitationDemo
        copy={{
          title: t("landing.demoTitle"),
          hint: t("landing.demoHint"),
          noteLabel: t("landing.demoNoteLabel"),
          noteBefore: t("landing.demoNoteBefore"),
          cited: t("landing.demoCited"),
          noteAfter: t("landing.demoNoteAfter"),
          summaryLabel: t("landing.demoSummaryLabel"),
          summary: t("landing.demoSummary"),
          flowLabel: t("landing.demoFlowLabel"),
          flow: [t("landing.demoFlow1"), t("landing.demoFlow2"), t("landing.demoFlow3")],
          quizLabel: t("landing.demoQuizLabel"),
          quizQuestion: t("landing.demoQuizQuestion"),
          quizAnswer: t("landing.demoQuizAnswer"),
          showSource: t("landing.demoShowSource"),
          sourceLabel: t("landing.demoSourceLabel"),
        }}
      />

      <section className="rounded-2xl bg-slate-900 p-8 text-center text-white" aria-labelledby="privacy">
        <h2 id="privacy" className="text-2xl font-bold">
          {t("landing.privacyTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">{t("landing.privacyBody")}</p>
        <Link href="/privacy" className="mt-4 inline-block text-sm font-medium text-indigo-300 hover:underline">
          {t("landing.learnMore")}
        </Link>
      </section>

      <footer className="mt-auto space-y-2 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        <p>
          <Link href="/terms" className="hover:underline">
            {t("legal.terms")}
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:underline">
            {t("legal.privacy")}
          </Link>
        </p>
        <p>{t("landing.footer")}</p>
      </footer>
    </main>
  );
}
