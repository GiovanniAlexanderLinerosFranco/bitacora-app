"use client";

import Link from "next/link";
import { useAuth } from "../../../../providers/auth-provider";
import { useTranslation } from "../../../../providers/i18n-provider";
import { ProfileCard } from "../../../../components/profile-card";
import { SubjectsManager } from "../../../../components/subjects-manager";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const name = profile?.displayName;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{name ? t("dashboard.welcome", { name }) : t("dashboard.welcomeNoName")}</h1>
          <p className="text-sm text-slate-500">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ledger" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
            {t("dashboard.goLedger")}
          </Link>
          <Link href="/chat" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {t("dashboard.goChat")}
          </Link>
        </div>
      </div>
      <ProfileCard />
      <SubjectsManager />
    </div>
  );
}
