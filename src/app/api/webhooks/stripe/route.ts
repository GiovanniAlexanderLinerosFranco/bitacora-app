import { NextResponse } from "next/server";
import { applyStripeEvent } from "../../../../services/billing.service";
import { serverEnv } from "../../../../lib/env";
import { getStripe } from "../../../../lib/stripe";

export const runtime = "nodejs";

/** Stripe calls this with a signed body. The signature is the authentication; there is no user session. */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const payload = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, serverEnv.stripeWebhookSecret());
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    await applyStripeEvent(event);
  } catch {
    console.error("[stripe]", event.type);
    return NextResponse.json({ error: "not processed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
