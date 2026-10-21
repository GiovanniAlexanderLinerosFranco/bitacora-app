import { createHash, timingSafeEqual } from "crypto";
import { billingUserId } from "./billing";

export const WOMPI_CURRENCY = "COP" as const;

/**
 * Integrity signature for a Wompi checkout in Colombian pesos.
 * SHA-256 of reference + amount in cents + currency + optional expiration + integrity secret.
 * https://docs.wompi.co/docs/colombia/widget-checkout-web/
 */
export function wompiIntegritySignature(input: {
  reference: string;
  amountInCents: number;
  currency: typeof WOMPI_CURRENCY;
  integritySecret: string;
  expirationTime?: string;
}): string {
  if (!Number.isInteger(input.amountInCents) || input.amountInCents < 1) {
    throw new Error("invalid amount");
  }
  const expiration = input.expirationTime ?? "";
  return sha256Hex(`${input.reference}${input.amountInCents}${input.currency}${expiration}${input.integritySecret}`);
}

/** Checksum for a Wompi event: property values, in order, then timestamp, then the events secret. */
export function wompiEventChecksum(input: {
  data: unknown;
  properties: string[];
  timestamp: number;
  eventsSecret: string;
}): string {
  const values = input.properties.map((property) => readEventProperty(input.data, property)).join("");
  return sha256Hex(`${values}${input.timestamp}${input.eventsSecret}`);
}

export function wompiChecksumMatches(expected: string, actual: string): boolean {
  const left = Buffer.from(expected.trim().toLowerCase(), "utf8");
  const right = Buffer.from(actual.trim().toLowerCase(), "utf8");
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Both the body checksum and the header must match when they are present. */
export function wompiEventIsAuthentic(computed: string, checksum: string | null, header: string | null): boolean {
  const presented = [checksum, header].filter((value): value is string => Boolean(value));
  if (presented.length === 0) return false;
  return presented.every((value) => wompiChecksumMatches(computed, value));
}

export function wompiReference(userId: string, nonce: string): string | null {
  if (!billingUserId(userId) || !/^[0-9a-f]{16}$/.test(nonce)) return null;
  return `bt-${userId}-${nonce}`;
}

export function userIdFromWompiReference(reference: string): string | null {
  const match = /^bt-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[0-9a-f]{16}$/i.exec(reference);
  return match ? billingUserId(match[1]) : null;
}

export function wompiTransactionId(value: string): string | null {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(value)) return null;
  return value;
}

export function wompiApiBase(publicKey: string): "https://sandbox.wompi.co/v1" | "https://production.wompi.co/v1" | null {
  if (publicKey.startsWith("pub_test_")) return "https://sandbox.wompi.co/v1";
  if (publicKey.startsWith("pub_prod_")) return "https://production.wompi.co/v1";
  return null;
}

/** Reads one dotted path from the event `data` object. Prototype keys are ignored. */
export function readEventProperty(data: unknown, path: string): string {
  if (!/^[A-Za-z0-9_.]+$/.test(path)) return "";
  let node: unknown = data;
  for (const part of path.split(".")) {
    if (!node || typeof node !== "object" || !Object.hasOwn(node, part)) return "";
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node === "string" || typeof node === "number" || typeof node === "boolean") return String(node);
  return "";
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
