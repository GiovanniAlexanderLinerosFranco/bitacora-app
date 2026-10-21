import "server-only";
import { WOMPI_PRO_PERIOD_DAYS } from "../lib/plan-limits";
import { publicEnv, serverEnv } from "../lib/env";
import {
  userIdFromWompiReference,
  wompiApiBase,
  wompiEventChecksum,
  wompiEventIsAuthentic,
  wompiTransactionId,
  WOMPI_CURRENCY,
  readEventProperty,
} from "../lib/wompi";
import { createAdminClient } from "../lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

interface ConfirmedTransaction {
  id: string;
  status: string;
  amountInCents: number;
  currency: string;
  reference: string;
}

/**
 * Applies one Wompi event after the events secret matches.
 * The owner comes from the reference this server created. Card numbers, emails and questions are not stored.
 */
export async function applyWompiEvent(payload: unknown, headerChecksum: string | null): Promise<void> {
  if (!payload || typeof payload !== "object") return;
  const event = payload as {
    event?: unknown;
    data?: unknown;
    timestamp?: unknown;
    signature?: { properties?: unknown; checksum?: unknown };
  };
  if (event.event !== "transaction.updated") return;
  if (!Array.isArray(event.signature?.properties) || typeof event.timestamp !== "number") return;
  const properties = event.signature.properties.filter((item): item is string => typeof item === "string");
  if (properties.length === 0 || properties.length > 8) return;

  const checksum = typeof event.signature.checksum === "string" ? event.signature.checksum : null;
  const computed = wompiEventChecksum({
    data: event.data,
    properties,
    timestamp: event.timestamp,
    eventsSecret: serverEnv.wompiEventsSecret(),
  });
  if (!wompiEventIsAuthentic(computed, checksum, headerChecksum)) return;

  const transaction = await confirmedTransaction(event.data);
  if (!transaction) return;
  const userId = userIdFromWompiReference(transaction.reference);
  if (!userId) return;
  if (transaction.currency !== WOMPI_CURRENCY || transaction.amountInCents !== proAmount()) return;

  const db = createAdminClient();
  const { data: profile, error: profileError } = await db.from("bitacora_profiles").select("id").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return;

  if (transaction.status === "APPROVED") {
    await writeWompi(db, userId, transaction, true);
    return;
  }
  if (transaction.status === "VOIDED" || transaction.status === "DECLINED" || transaction.status === "ERROR") {
    await writeWompi(db, userId, transaction, false);
  }
}

async function confirmedTransaction(data: unknown): Promise<ConfirmedTransaction | null> {
  const id = wompiTransactionId(readEventProperty(data, "transaction.id"));
  const reference = readEventProperty(data, "transaction.reference");
  const status = readEventProperty(data, "transaction.status");
  const currency = readEventProperty(data, "transaction.currency");
  const amount = Number(readEventProperty(data, "transaction.amount_in_cents"));
  if (!id || !reference || !status || !Number.isInteger(amount)) return null;

  const base = wompiApiBase(publicEnv.wompiPublicKey());
  if (!base) throw new Error("wompi public key");
  const response = await fetch(`${base}/transactions/${id}`, {
    headers: { Authorization: `Bearer ${serverEnv.wompiPrivateKey()}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("wompi transaction lookup failed");
  const body = (await response.json()) as { data?: Record<string, unknown> };
  const remote = body.data;
  if (!remote) return null;
  if (remote.id !== id || remote.reference !== reference || remote.status !== status) return null;
  if (remote.currency !== currency || remote.amount_in_cents !== amount) return null;
  return { id, status, amountInCents: amount, currency, reference };
}

async function writeWompi(db: AdminClient, userId: string, transaction: ConfirmedTransaction, approved: boolean): Promise<void> {
  const { data: existing, error: readError } = await db
    .from("bitacora_subscriptions")
    .select("payment_provider, plan_type, subscription_status, wompi_transaction_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;

  if (!approved) {
    const stripeStillActive =
      existing?.payment_provider === "stripe" && existing.plan_type === "pro" && existing.subscription_status === "active";
    const otherWompiStillActive =
      existing?.subscription_status === "active" &&
      existing.plan_type === "pro" &&
      typeof existing.wompi_transaction_id === "string" &&
      existing.wompi_transaction_id !== transaction.id;
    if (stripeStillActive || otherWompiStillActive) return;
  }

  const periodEnd = approved ? new Date(Date.now() + WOMPI_PRO_PERIOD_DAYS * 86_400_000).toISOString() : null;
  const { error } = await db.from("bitacora_subscriptions").upsert(
    {
      user_id: userId,
      payment_provider: "wompi",
      plan_type: approved ? "pro" : "free",
      subscription_status: approved ? "active" : "canceled",
      wompi_transaction_id: transaction.id,
      wompi_reference: transaction.reference,
      current_period_end: periodEnd,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

function proAmount(): number {
  const raw = serverEnv.wompiProAmountInCents();
  if (!/^[1-9][0-9]{2,8}$/.test(raw)) throw new Error("invalid wompi amount");
  return Number(raw);
}
