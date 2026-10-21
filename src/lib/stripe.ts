import "server-only";
import Stripe from "stripe";
import { serverEnv } from "./env";

let client: Stripe | null = null;

/** Server Stripe client. The secret key never reaches the browser. */
export function getStripe(): Stripe {
  client ??= new Stripe(serverEnv.stripeSecretKey());
  return client;
}
