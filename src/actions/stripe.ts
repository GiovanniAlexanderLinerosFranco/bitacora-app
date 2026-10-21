"use server";

import { fail, ok, requireUser } from "../lib/actions/helpers";
import { grantsProAccess, isStripeBillingUrl, type PlanType, type SubscriptionStatus } from "../lib/billing";
import { publicEnv, serverEnv } from "../lib/env";
import { getStripe } from "../lib/stripe";
import { createClient } from "../lib/supabase/server";
import type { ActionResponse } from "../types";

export interface BillingSnapshot {
  signedIn: boolean;
  planType: PlanType;
  subscriptionStatus: SubscriptionStatus | null;
  paymentProvider: "stripe" | "wompi" | null;
  /** True only while Pro is paid and the recorded period, if any, has not ended. */
  proAccess: boolean;
  /** True when Stripe already has a customer for this account, so the portal can open. */
  canManagePortal: boolean;
}

const EMPTY: BillingSnapshot = {
  signedIn: false,
  planType: "free",
  subscriptionStatus: null,
  paymentProvider: null,
  proAccess: false,
  canManagePortal: false,
};

function asPlan(value: unknown): PlanType {
  return value === "pro" ? "pro" : "free";
}

function asStatus(value: unknown): SubscriptionStatus | null {
  return value === "active" || value === "canceled" || value === "past_due" ? value : null;
}

/** Reads this account's plan. A missing billing table keeps the free snapshot so pricing still renders. */
export async function getBillingSnapshot(): Promise<BillingSnapshot> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return EMPTY;

  const { data: row, error } = await supabase
    .from("bitacora_subscriptions")
    .select("plan_type, subscription_status, payment_provider, stripe_customer_id, current_period_end")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (error || !row) {
    if (error) console.error("[billing]", error.code);
    return { ...EMPTY, signedIn: true };
  }
  return {
    signedIn: true,
    planType: asPlan(row.plan_type),
    subscriptionStatus: asStatus(row.subscription_status),
    paymentProvider: row.payment_provider === "wompi" ? "wompi" : "stripe",
    proAccess: grantsProAccess(asPlan(row.plan_type), asStatus(row.subscription_status), (row.current_period_end as string | null) ?? null),
    canManagePortal: typeof row.stripe_customer_id === "string" && row.stripe_customer_id.length > 0,
  };
}

async function billingRedirect(url: string | null): Promise<ActionResponse<{ url: string }>> {
  if (!url || !isStripeBillingUrl(url)) return fail("billing_unavailable", "Payments are not available right now.");
  return ok({ url });
}

/** Starts Stripe Checkout for the Pro price. The owner id is stored in the session metadata. */
export async function createCheckoutSession(): Promise<ActionResponse<{ url: string }>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const { data: row, error } = await auth.supabase
    .from("bitacora_subscriptions")
    .select("plan_type, subscription_status, current_period_end, stripe_customer_id")
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error && error.code !== "PGRST205") return fail("billing_unavailable", "Payments are not available right now.");
  if (grantsProAccess(asPlan(row?.plan_type), asStatus(row?.subscription_status), (row?.current_period_end as string | null) ?? null)) {
    return fail("already_subscribed", "Pro is already active. Manage it from the billing portal.");
  }

  const { data: userData } = await auth.supabase.auth.getUser();
  const email = userData.user?.email;
  const customerId = typeof row?.stripe_customer_id === "string" ? row.stripe_customer_id : null;
  const origin = publicEnv.appUrl().replace(/\/$/, "");

  try {
    const price = serverEnv.stripeProPriceId();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      client_reference_id: auth.userId,
      metadata: { user_id: auth.userId },
      subscription_data: { metadata: { user_id: auth.userId } },
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      ...(customerId ? { customer: customerId } : email ? { customer_email: email } : {}),
    });
    return billingRedirect(session.url);
  } catch {
    console.error("[stripe] checkout");
    return fail("billing_unavailable", "Payments are not available right now.");
  }
}

/** Opens the Stripe customer portal so this account can update or cancel Pro. */
export async function createCustomerPortalSession(): Promise<ActionResponse<{ url: string }>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const { data: row, error } = await auth.supabase
    .from("bitacora_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) return fail("billing_unavailable", "Payments are not available right now.");
  const customerId = typeof row?.stripe_customer_id === "string" ? row.stripe_customer_id : null;
  if (!customerId) return fail("not_found", "No billing account yet.");

  try {
    const origin = publicEnv.appUrl().replace(/\/$/, "");
    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/pricing`,
    });
    return billingRedirect(portal.url);
  } catch {
    console.error("[stripe] portal");
    return fail("billing_unavailable", "Payments are not available right now.");
  }
}
