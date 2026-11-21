import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS — only use in server code paths that
 * scope every query explicitly (public team-link endpoints, push fan-out,
 * super-admin user management).
 */
export function createServiceClient() {
  return createClient<Database>(publicEnv.supabaseUrl(), serverEnv.serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
