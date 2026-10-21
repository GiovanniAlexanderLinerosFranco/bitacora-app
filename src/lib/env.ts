function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Public values (safe in the browser). NEXT_PUBLIC_* must be referenced literally to be inlined. */
export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  stripePublishableKey: () => process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  wompiPublicKey: () => process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? "",
};

/** Server-only values. Never import this module's `serverEnv` from client components. */
export const serverEnv = {
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  openaiApiKey: () => required("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
  openaiGenerationModel: () => process.env.OPENAI_GENERATION_MODEL ?? "gpt-4o-mini",
  openaiEmbeddingModel: () => process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  openaiTranscriptionModel: () => process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1",
  stripeSecretKey: () => required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET),
  stripeProPriceId: () => required("STRIPE_PRO_PRICE_ID", process.env.STRIPE_PRO_PRICE_ID),
  wompiPrivateKey: () => required("WOMPI_PRIVATE_KEY", process.env.WOMPI_PRIVATE_KEY),
  wompiEventsSecret: () => required("WOMPI_EVENTS_SECRET", process.env.WOMPI_EVENTS_SECRET),
  wompiIntegritySecret: () => required("WOMPI_INTEGRITY_SECRET", process.env.WOMPI_INTEGRITY_SECRET),
  wompiProAmountInCents: () => required("WOMPI_PRO_AMOUNT_IN_CENTS", process.env.WOMPI_PRO_AMOUNT_IN_CENTS),
};

// Must match vector(1536) in the migrations and the native size of text-embedding-3-small.
export const EMBEDDING_DIMENSIONS = 1536;
