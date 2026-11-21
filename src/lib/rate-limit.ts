import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { serverEnv } from "@/lib/env";

/** Hashed client IP (raw IPs are never stored). */
export async function clientFingerprint(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`${serverEnv.rateLimitSalt()}:${ip}`).digest("hex").slice(0, 32);
}

export type Limit = { key: string; limit: number; windowSeconds: number };

/** Returns true if every limit allows the call. Fails open if the limiter itself errors. */
export async function checkRateLimits(limits: Limit[]): Promise<boolean> {
  const supabase = createServiceClient();
  for (const l of limits) {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: l.key,
      p_limit: l.limit,
      p_window_seconds: l.windowSeconds,
    });
    if (error) {
      console.error("rate limit check failed", error.message);
      continue;
    }
    if (data === false) return false;
  }
  return true;
}

export const LIMITS = {
  submitPerClient: (team: string, fp: string): Limit => ({
    key: `submit:${team}:${fp}`,
    limit: 12,
    windowSeconds: 600,
  }),
  submitPerTeam: (team: string): Limit => ({ key: `submit-team:${team}`, limit: 300, windowSeconds: 3600 }),
  historyPerClient: (fp: string): Limit => ({ key: `history:${fp}`, limit: 40, windowSeconds: 600 }),
  loginPerClient: (fp: string): Limit => ({ key: `login:${fp}`, limit: 10, windowSeconds: 600 }),
};
