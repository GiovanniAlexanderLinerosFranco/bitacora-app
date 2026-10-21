/** Funnel marks for the personal layer. The name list is closed. */
export const PRODUCT_EVENTS = [
  "sign_up",
  "first_note_created",
  "first_embedding_ready",
  "first_query_asked",
  "citation_miss",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

const EVENT_SET = new Set<string>(PRODUCT_EVENTS);

/** Keys that would carry private ledger content. Compared after normalization. */
const FORBIDDEN_KEYS = new Set([
  "rawtext",
  "question",
  "content",
  "quote",
  "title",
  "extractedtext",
  "answer",
  "prompt",
  "attachment",
  "filename",
  "filepath",
  "body",
]);

const MAX_STRING = 40;
const MAX_KEYS = 8;

export function isProductEventName(value: string): value is ProductEventName {
  return EVENT_SET.has(value);
}

/**
 * Keeps only short scalars. Drops free text, note bodies, questions, quotes and file names.
 * A string longer than a short code is discarded rather than truncated, so a question cannot be stored in pieces.
 */
export function sanitizeEventMetadata(input: unknown): Record<string, string | number | boolean> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [rawKey, value] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_KEYS) break;
    const key = rawKey.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!key || FORBIDDEN_KEYS.has(key.replace(/_/g, ""))) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || trimmed.length > MAX_STRING) continue;
      out[key] = trimmed;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}
