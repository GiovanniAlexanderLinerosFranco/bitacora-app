import { describe, expect, it } from "vitest";
import { grantsProAccess } from "./billing";
import {
  userIdFromWompiReference,
  wompiChecksumMatches,
  wompiEventChecksum,
  wompiEventIsAuthentic,
  wompiIntegritySignature,
  wompiReference,
} from "./wompi";

const OWNER = "11111111-1111-4111-8111-111111111111";
const SECRET = "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6";

describe("wompiIntegritySignature", () => {
  it("matches the SHA-256 example published by Wompi", () => {
    expect(
      wompiIntegritySignature({
        reference: "sk8-438k4-xmxm392-sn2m",
        amountInCents: 2_490_000,
        currency: "COP",
        integritySecret: SECRET,
      }),
    ).toBe("37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5");
  });

  it("includes the expiration instant when the checkout sets one", () => {
    const withoutExpiration = wompiIntegritySignature({
      reference: "sk8-438k4-xmxm392-sn2m",
      amountInCents: 2_490_000,
      currency: "COP",
      integritySecret: SECRET,
    });
    const withExpiration = wompiIntegritySignature({
      reference: "sk8-438k4-xmxm392-sn2m",
      amountInCents: 2_490_000,
      currency: "COP",
      integritySecret: SECRET,
      expirationTime: "2023-06-09T20:28:50.000Z",
    });
    expect(withExpiration).not.toBe(withoutExpiration);
    expect(withExpiration).toHaveLength(64);
  });
});

describe("wompi events", () => {
  const data = { transaction: { id: "1234-1610641025-49201", status: "APPROVED", amount_in_cents: 4_490_000 } };
  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];

  it("hashes the listed properties, the timestamp and the events secret", () => {
    const checksum = wompiEventChecksum({ data, properties, timestamp: 1530291411, eventsSecret: "prod_events_example" });
    expect(checksum).toBe("8a0e36d6befc573ab04ef0b887d09eccad9dfc20eb0e388f748ce19b6beb16bb");
    expect(wompiEventIsAuthentic(checksum, checksum, checksum.toUpperCase())).toBe(true);
    expect(wompiChecksumMatches(checksum, "0".repeat(64))).toBe(false);
  });

  it("rejects an event when the header and the body disagree", () => {
    const checksum = wompiEventChecksum({ data, properties, timestamp: 1530291411, eventsSecret: "prod_events_example" });
    expect(wompiEventIsAuthentic(checksum, checksum, "f".repeat(64))).toBe(false);
  });
});

describe("wompi reference", () => {
  it("embeds only a verified owner id", () => {
    const reference = wompiReference(OWNER, "abcdef0123456789");
    expect(reference).toBe(`bt-${OWNER}-abcdef0123456789`);
    expect(userIdFromWompiReference(reference ?? "")).toBe(OWNER);
    expect(wompiReference("not-a-user", "abcdef0123456789")).toBeNull();
    expect(userIdFromWompiReference("bt-someone-else")).toBeNull();
  });
});

describe("grantsProAccess", () => {
  it("treats an active Pro row the same for Wompi and Stripe", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(grantsProAccess("pro", "active", future)).toBe(true);
    expect(grantsProAccess("pro", "active", null)).toBe(true);
    expect(grantsProAccess("pro", "active", past)).toBe(false);
    expect(grantsProAccess("pro", "canceled", future)).toBe(false);
  });
});
