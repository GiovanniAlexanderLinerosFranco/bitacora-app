"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslation } from "../../providers/i18n-provider";
import type { TranslationKey } from "../../lib/i18n";
import { LanguageSwitcher } from "../layout/language-switcher";
import { Card } from "../ui";

/** Shared frame for every auth screen: brand, language switcher and legal links. */
export function AuthShell({ title, subtitle, children }: { title: TranslationKey; subtitle?: TranslationKey; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-indigo-700">
            {t("app.name")}
          </Link>
          <LanguageSwitcher />
        </div>
        <Card>
          <div className="mb-4">
            <h1 className="text-lg font-semibold">{t(title)}</h1>
            {subtitle && <p className="text-sm text-slate-500">{t(subtitle)}</p>}
          </div>
          {children}
        </Card>
        <p className="text-center text-xs text-slate-500">
          <Link href="/terms" className="hover:underline">
            {t("legal.terms")}
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:underline">
            {t("legal.privacy")}
          </Link>
        </p>
      </div>
    </div>
  );
}
