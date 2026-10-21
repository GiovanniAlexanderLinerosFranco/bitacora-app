import { describe, expect, it } from "vitest";
import {
  billingFromStripeStatus,
  billingUserId,
  isProActive,
  isStripeBillingUrl,
  stripeObjectId,
  subscriptionPeriodEndIso,
} from "./billing";

const OWNER = "11111111-1111-4111-8111-111111111111";

describe("billingFromStripeStatus", () => {
  it("activates Pro for an active or trialing subscription", () => {
    expect(billingFromStripeStatus("active")).toEqual({ planType: "pro", subscriptionStatus: "active" });
    expect(billingFromStripeStatus("trialing")).toEqual({ planType: "pro", subscriptionStatus: "active" });
  });

  it("keeps the Pro label when payment is past due, without treating it as active", () => {
    expect(billingFromStripeStatus("past_due")).toEqual({ planType: "pro", subscriptionStatus: "past_due" });
    expect(isProActive("pro", "past_due")).toBe(false);
  });

  it("returns the account to the free plan when the subscription ends", () => {
    expect(billingFromStripeStatus("canceled")).toEqual({ planType: "free", subscriptionStatus: "canceled" });
    expect(billingFromStripeStatus("incomplete_expired")).toEqual({ planType: "free", subscriptionStatus: "canceled" });
    expect(isProActive("free", "canceled")).toBe(false);
  });
});

describe("billing identifiers", () => {
  it("accepts the signed owner id and Stripe object ids", () => {
    expect(billingUserId(OWNER)).toBe(OWNER);
    expect(billingUserId("not-a-user")).toBeNull();
    expect(stripeObjectId("cus_abc123", "cus_")).toBe("cus_abc123");
    expect(stripeObjectId("sub_abc123", "sub_")).toBe("sub_abc123");
    expect(stripeObjectId("cus_abc", "sub_")).toBeNull();
  });

  it("allows only Stripe hosted checkout and portal URLs", () => {
    expect(isStripeBillingUrl("https://checkout.stripe.com/c/pay/cs_test")).toBe(true);
    expect(isStripeBillingUrl("https://billing.stripe.com/p/session/test")).toBe(true);
    expect(isStripeBillingUrl("https://example.com/checkout.stripe.com")).toBe(false);
    expect(isStripeBillingUrl("http://checkout.stripe.com/c/pay/cs_test")).toBe(false);
  });

  it("reads the billing period from the subscription item", () => {
    expect(subscriptionPeriodEndIso({ items: { data: [{ current_period_end: 1_800_000_000 }] } })).toBe(
      new Date(1_800_000_000 * 1000).toISOString(),
    );
    expect(subscriptionPeriodEndIso({})).toBeNull();
  });
});
