function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** Public values (safe in the browser). NEXT_PUBLIC_* must be referenced literally to be inlined. */
export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

/** Server-only values. Never import this module's `serverEnv` from client components. */
export const serverEnv = {
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  openaiApiKey: () => required("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
  openaiGenerationModel: () => process.env.OPENAI_GENERATION_MODEL ?? "gpt-4o-mini",
  openaiEmbeddingModel: () => process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  openaiTranscriptionModel: () => process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1",
};

// Must match vector(1536) in the migrations and the native size of text-embedding-3-small.
export const EMBEDDING_DIMENSIONS = 1536;
