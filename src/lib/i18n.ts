import type { Messages } from "../locales";

type Paths<T> = { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];

/** Dot-path of any string in the translation files, e.g. "ledger.types.meeting". Typos fail at compile time. */
export type TranslationKey = Paths<Messages>;
export type TranslationParams = Record<string, string | number>;

export function translate(messages: Messages, key: TranslationKey, params?: TranslationParams): string {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) node = (node as Record<string, unknown>)[part];
    else return key;
  }
  if (typeof node !== "string") return key;
  return params ? node.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)) : node;
}

/** Formats a YYYY-MM-DD date in the given locale without timezone shifts. */
export function formatDate(date: string, locale: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(y, m - 1, d));
}
