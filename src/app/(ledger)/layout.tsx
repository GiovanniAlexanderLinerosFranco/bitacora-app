import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { resolveLocale } from "../../locales";
import { Providers } from "../../providers";
import "../../styles/globals.css";

export const metadata: Metadata = { title: "Smart Learning Ledger" };

export default async function LedgerRootLayout({ children }: { children: ReactNode }) {
  const initialLocale = resolveLocale((await headers()).get("accept-language"));
  return (
    <html lang={initialLocale}>
      <body className="min-h-screen antialiased">
        <Providers initialLocale={initialLocale}>{children}</Providers>
      </body>
    </html>
  );
}
