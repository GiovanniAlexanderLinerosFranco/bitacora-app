"use server";

import { requireUser } from "../lib/actions/helpers";
import { recordOwnedProductEvent } from "../services/product-events.service";

/** Records that this account reached the product. Safe to call more than once. Stores no profile text. */
export async function recordSignUp(): Promise<void> {
  const auth = await requireUser();
  if (auth.error) return;
  await recordOwnedProductEvent(auth.supabase, auth.userId, "sign_up");
}
