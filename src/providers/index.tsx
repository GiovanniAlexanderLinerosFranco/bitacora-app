"use client";

import type { ReactNode } from "react";
import type { Locale } from "../types";
import { AuthProvider } from "./auth-provider";
import { I18nProvider } from "./i18n-provider";

export function Providers({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  return (
    <AuthProvider>
      <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
    </AuthProvider>
  );
}
