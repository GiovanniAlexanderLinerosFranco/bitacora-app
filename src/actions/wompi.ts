"use server";

import { randomBytes } from "crypto";
import { fail, ok, requireUser } from "../lib/actions/helpers";
import { grantsProAccess } from "../lib/billing";
import { publicEnv, serverEnv } from "../lib/env";
import { wompiApiBase, wompiIntegritySignature, wompiReference, WOMPI_CURRENCY } from "../lib/wompi";
import type { ActionResponse } from "../types";

export interface WompiCheckout {
  publicKey: string;
  currency: typeof WOMPI_CURRENCY;
  amountInCents: number;
  reference: string;
  integrity: string;
  expirationTime: string;
  redirectUrl: string;
}

/** Builds a signed Wompi checkout for this account. The integrity secret stays on the server. */
export async function createWompiCheckoutSession(): Promise<ActionResponse<WompiCheckout>> {
  const auth = await requireUser();
  if (auth.error) return { data: null, error: auth.error };

  const { data: row, error } = await auth.supabase
    .from("bitacora_subscriptions")
    .select("plan_type, subscription_status, current_period_end")
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error && error.code !== "PGRST205") return fail("billing_unavailable", "Payments are not available right now.");
  if (
    grantsProAccess(
      row?.plan_type as string | undefined,
      row?.subscription_status as string | undefined,
      (row?.current_period_end as string | null) ?? null,
    )
  ) {
    return fail("already_subscribed", "Pro is already active.");
  }

  try {
    const publicKey = publicEnv.wompiPublicKey();
    const amountRaw = serverEnv.wompiProAmountInCents();
    if (!wompiApiBase(publicKey) || !/^[1-9][0-9]{2,8}$/.test(amountRaw)) {
      return fail("billing_unavailable", "Payments are not available right now.");
    }
    const amountInCents = Number(amountRaw);
    const reference = wompiReference(auth.userId, randomBytes(8).toString("hex"));
    if (!reference) return fail("billing_unavailable", "Payments are not available right now.");
    const expirationTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const integrity = wompiIntegritySignature({
      reference,
      amountInCents,
      currency: WOMPI_CURRENCY,
      integritySecret: serverEnv.wompiIntegritySecret(),
      expirationTime,
    });
    const origin = publicEnv.appUrl().replace(/\/$/, "");
    return ok({
      publicKey,
      currency: WOMPI_CURRENCY,
      amountInCents,
      reference,
      integrity,
      expirationTime,
      redirectUrl: `${origin}/pricing?checkout=wompi`,
    });
  } catch {
    console.error("[wompi] checkout");
    return fail("billing_unavailable", "Payments are not available right now.");
  }
}
