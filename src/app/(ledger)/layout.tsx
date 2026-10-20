import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { dirFor, localeFromAcceptLanguage, resolveLocale } from "../../locales";
import { Providers } from "../../providers";
import { LOCALE_COOKIE } from "../../types";
import "../../styles/globals.css";

export const metadata: Metadata = { title: "Smart Learning Ledger" };

export default async function LedgerRootLayout({ children }: { children: ReactNode }) {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const initialLocale = saved ? resolveLocale(saved) : localeFromAcceptLanguage((await headers()).get("accept-language"));
  return (
    <html lang={initialLocale} dir={dirFor(initialLocale)}>
      <body className="min-h-screen antialiased">
        <Providers initialLocale={initialLocale}>{children}</Providers>
      </body>
    </html>
  );
}
