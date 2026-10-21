export const PLAN_TYPES = ["free", "pro"] as const;
export const SUBSCRIPTION_STATUSES = ["active", "canceled", "past_due"] as const;

export type PlanType = (typeof PLAN_TYPES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export interface BillingState {
  planType: PlanType;
  subscriptionStatus: SubscriptionStatus;
}

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pro limits apply only while the plan is active. The payment provider is not part of this check. */
export function isProActive(planType: string | null | undefined, status: string | null | undefined): boolean {
  return planType === "pro" && status === "active";
}

/** Active Pro whose paid period, when recorded, has not ended. A missing period end stays active. */
export function grantsProAccess(
  planType: string | null | undefined,
  status: string | null | undefined,
  periodEnd: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!isProActive(planType, status)) return false;
  if (!periodEnd) return true;
  const end = Date.parse(periodEnd);
  return Number.isFinite(end) && end > now;
}

/**
 * Maps a Stripe subscription status onto the two columns this app stores.
 * Cancellation and any unrecognized status return the account to the free plan.
 */
export function billingFromStripeStatus(stripeStatus: string): BillingState {
  if (stripeStatus === "active" || stripeStatus === "trialing") {
    return { planType: "pro", subscriptionStatus: "active" };
  }
  if (stripeStatus === "past_due" || stripeStatus === "unpaid" || stripeStatus === "paused") {
    return { planType: "pro", subscriptionStatus: "past_due" };
  }
  return { planType: "free", subscriptionStatus: "canceled" };
}

/** Accepts only the owner id this server put in Stripe metadata. */
export function billingUserId(value: string | null | undefined): string | null {
  if (!value || !USER_ID.test(value)) return null;
  return value;
}

export function stripeObjectId(value: string | null | undefined, prefix: "cus_" | "sub_"): string | null {
  if (!value || !value.startsWith(prefix) || value.length > 80) return null;
  if (!new RegExp(`^${prefix}[A-Za-z0-9]+$`).test(value)) return null;
  return value;
}

/** Checkout and the customer portal. Anything else is not a redirect target. */
export function isStripeBillingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "checkout.stripe.com" || url.hostname === "billing.stripe.com");
  } catch {
    return false;
  }
}

/** Stripe API 2026 stores the period end on the subscription item, not on the subscription. */
export function subscriptionPeriodEndIso(subscription: {
  items?: { data?: { current_period_end?: number | null }[] };
}): string | null {
  const unix = subscription.items?.data?.[0]?.current_period_end;
  if (!unix || !Number.isFinite(unix)) return null;
  return new Date(unix * 1000).toISOString();
}
