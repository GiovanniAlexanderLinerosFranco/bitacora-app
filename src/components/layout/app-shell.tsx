"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../../providers/auth-provider";
import { useTranslation } from "../../providers/i18n-provider";
import type { TranslationKey } from "../../lib/i18n";
import { Button } from "../ui";
import { LanguageSwitcher } from "./language-switcher";

const LINKS: { href: string; label: TranslationKey }[] = [
  { href: "/dashboard", label: "nav.dashboard" },
  { href: "/ledger", label: "nav.ledger" },
  { href: "/chat", label: "nav.chat" },
  { href: "/pricing", label: "pricing.nav" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  // Defence in depth: middleware already redirects, this covers expired sessions in a long-lived tab.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">{t("common.loading")}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <span className="hidden text-sm font-semibold text-indigo-700 sm:block">{t("app.name")}</span>
          <nav className="flex flex-1 gap-1" aria-label="Main">
            {LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {t(label)}
                </Link>
              );
            })}
          </nav>
          {profile?.displayName && <span className="hidden text-sm text-slate-500 md:block">{profile.displayName}</span>}
          <LanguageSwitcher />
          <Button
            variant="ghost"
            onClick={async () => {
              await signOut();
              router.replace("/login");
              router.refresh();
            }}
          >
            {t("common.signOut")}
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
