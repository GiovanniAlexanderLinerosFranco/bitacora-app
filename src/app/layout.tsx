import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { dirFor, localeFromAcceptLanguage, resolveLocale } from "../locales";
import { publicEnv } from "../lib/env";
import { isLocale } from "../lib/public-locale";
import { Providers } from "../providers";
import { LOCALE_COOKIE } from "../types";
import "../styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl()),
  title: "Smart Learning Ledger",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const fromPath = requestHeaders.get("x-bitacora-locale");
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  const initialLocale =
    fromPath && isLocale(fromPath)
      ? fromPath
      : saved
        ? resolveLocale(saved)
        : localeFromAcceptLanguage(requestHeaders.get("accept-language"));
  return (
    <html lang={initialLocale} dir={dirFor(initialLocale)} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers initialLocale={initialLocale}>{children}</Providers>
      </body>
    </html>
  );
}
