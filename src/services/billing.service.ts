import "server-only";
import type Stripe from "stripe";
import { billingFromStripeStatus, billingUserId, stripeObjectId, subscriptionPeriodEndIso } from "../lib/billing";
import { getStripe } from "../lib/stripe";
import { createAdminClient } from "../lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

function customerIdOf(customer: string | { id: string } | null | undefined): string | null {
  const id = typeof customer === "string" ? customer : customer?.id;
  return stripeObjectId(id, "cus_");
}

/**
 * Applies one verified Stripe event to the personal billing row.
 * The owner id comes from metadata this server wrote, or from a row already tied to that Stripe customer.
 * The service role bypasses row level security, so every statement filters by that one user id.
 */
export async function applyStripeEvent(event: Stripe.Event): Promise<void> {
  const db = createAdminClient();
  if (event.type === "checkout.session.completed") {
    await applyCheckout(db, event.data.object);
    return;
  }
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await applySubscription(db, event.data.object, event.type === "customer.subscription.deleted");
  }
}

async function profileExists(db: AdminClient, userId: string): Promise<boolean> {
  const { data, error } = await db.from("bitacora_profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function applyCheckout(db: AdminClient, session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription") return;
  const userId = billingUserId(session.metadata?.user_id ?? session.client_reference_id);
  const customerId = customerIdOf(session.customer);
  const subscriptionId = stripeObjectId(typeof session.subscription === "string" ? session.subscription : session.subscription?.id, "sub_");
  if (!userId || !customerId || !subscriptionId) return;
  if (!(await profileExists(db, userId))) return;

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const subscriptionCustomer = customerIdOf(subscription.customer);
  const metadataOwner = billingUserId(subscription.metadata?.user_id);
  if (subscriptionCustomer !== customerId || (metadataOwner && metadataOwner !== userId)) return;

  await writeBilling(db, userId, customerId, subscriptionId, subscription, false);
}

async function applySubscription(db: AdminClient, subscription: Stripe.Subscription, deleted: boolean): Promise<void> {
  const customerId = customerIdOf(subscription.customer);
  const subscriptionId = stripeObjectId(subscription.id, "sub_");
  if (!customerId || !subscriptionId) return;

  const metadataOwner = billingUserId(subscription.metadata?.user_id);
  const { data: existing, error } = await db
    .from("bitacora_subscriptions")
    .select("user_id, payment_provider, plan_type, subscription_status")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  const storedOwner = billingUserId(existing?.user_id as string | undefined);
  if (metadataOwner && storedOwner && metadataOwner !== storedOwner) return;

  const userId = metadataOwner ?? storedOwner;
  if (!userId || !(await profileExists(db, userId))) return;
  if (
    deleted &&
    existing?.payment_provider === "wompi" &&
    existing.plan_type === "pro" &&
    existing.subscription_status === "active"
  ) {
    const { error: updateError } = await db
      .from("bitacora_subscriptions")
      .update({ stripe_customer_id: customerId, stripe_subscription_id: subscriptionId })
      .eq("user_id", userId);
    if (updateError) throw updateError;
    return;
  }
  await writeBilling(db, userId, customerId, subscriptionId, subscription, deleted);
}

async function writeBilling(
  db: AdminClient,
  userId: string,
  customerId: string,
  subscriptionId: string,
  subscription: Stripe.Subscription,
  deleted: boolean,
): Promise<void> {
  const mapped = deleted
    ? { planType: "free" as const, subscriptionStatus: "canceled" as const }
    : billingFromStripeStatus(subscription.status);
  const { error } = await db.from("bitacora_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan_type: mapped.planType,
      subscription_status: mapped.subscriptionStatus,
      payment_provider: "stripe",
      current_period_end: subscriptionPeriodEndIso(subscription),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
