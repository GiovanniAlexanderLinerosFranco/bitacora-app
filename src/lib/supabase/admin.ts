import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "../env";

/** Service-role client: BYPASSES RLS. Only for trusted pipelines (e.g. writing embeddings); always scope by user_id. */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl(), serverEnv.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
