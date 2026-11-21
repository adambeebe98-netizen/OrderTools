/**
 * Integration tests against a local Supabase (`npx supabase start` + `npx supabase db reset`).
 * Skipped automatically when the local stack isn't reachable.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
// Default keys of the local Supabase CLI stack (not secrets).
const ANON =
  process.env.TEST_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

type DB = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const reachable = await fetch(`${URL}/auth/v1/health`, { headers: { apikey: ANON } })
  .then((r) => r.ok)
  .catch(() => false);

async function signedIn(email: string): Promise<DB> {
  const c = createClient<Database>(URL, ANON, opts);
  const { error } = await c.auth.signInWithPassword({ email, password: "password123" });
  if (error) throw error;
  return c;
}

describe.skipIf(!reachable)("database security & logic", () => {
  let anon: DB, service: DB, managerB: DB;
  let teamA: string, teamB: string;
  let catalogA: string, catalogB: string;

  beforeAll(async () => {
    anon = createClient<Database>(URL, ANON, opts);
    service = createClient<Database>(URL, SERVICE, opts);
    managerB = await signedIn("other@example.com"); // manager of South team only
    const { data: teams } = await service.from("teams").select("id, slug");
    teamA = teams!.find((t) => t.slug === "north-install-demo")!.id;
    teamB = teams!.find((t) => t.slug === "south-install-demo")!.id;
    const { data: a } = await service.from("catalog_items").select("id").eq("team_id", teamA).limit(1).single();
    const { data: b } = await service.from("catalog_items").select("id").eq("team_id", teamB).limit(1).single();
    catalogA = a!.id;
    catalogB = b!.id;
  });

  it("anon role cannot read or write any table", async () => {
    const { data } = await anon.from("requests").select("id");
    expect(data ?? []).toHaveLength(0);
    const { error } = await anon.from("teams").insert({ name: "x", slug: "evil-team-1" });
    expect(error).not.toBeNull();
    const rpc = await anon.rpc("submit_request", { p_slug: "north-install-demo", p_technician_name: "x", p_items: [] });
    expect(rpc.error).not.toBeNull();
  });

  it("a manager only sees their own team's data", async () => {
    const { data: teams } = await managerB.from("teams").select("id");
    expect(teams!.map((t) => t.id)).toEqual([teamB]);
    const { data: reqs } = await managerB.from("requests").select("team_id");
    expect(reqs!.length).toBeGreaterThan(0);
    expect(new Set(reqs!.map((r) => r.team_id))).toEqual(new Set([teamB]));
    const { data: items } = await managerB.from("catalog_items").select("id").eq("team_id", teamA);
    expect(items).toHaveLength(0);
  });

  it("a manager cannot modify another team's data", async () => {
    const { data: aItem } = await service.from("request_items").select("id").eq("team_id", teamA).eq("status", "requested").limit(1).single();
    const upd = await managerB.from("request_items").update({ quantity: 999 }).eq("id", aItem!.id).select();
    expect(upd.data ?? []).toHaveLength(0);
    const rpc = await managerB.rpc("mark_items_ordered", { p_team_id: teamA, p_item_ids: [aItem!.id] });
    expect(rpc.error?.message).toMatch(/forbidden/);
    // Cannot join another team or flip their own role.
    const join = await managerB.from("team_members").insert({ team_id: teamA, user_id: (await managerB.auth.getUser()).data.user!.id });
    expect(join.error).not.toBeNull();
    const promote = await managerB.from("profiles").update({ is_super_admin: true }).eq("id", (await managerB.auth.getUser()).data.user!.id);
    expect(promote.error).not.toBeNull();
    const move = await managerB.from("team_members").update({ team_id: teamA } as never).eq("team_id", teamB);
    expect(move.error).not.toBeNull();
  });

  it("cross-team references are rejected by composite foreign keys", async () => {
    // Team B manager tries to attach a request item to a Team A request.
    const { data: aReq } = await service.from("requests").select("id").eq("team_id", teamA).limit(1).single();
    const { error } = await managerB
      .from("request_items")
      .insert({ request_id: aReq!.id, team_id: teamB, name: "sneaky", quantity: 1 });
    expect(error).not.toBeNull();
  });

  it("submit_request validates catalog items belong to the team", async () => {
    const bad = await service.rpc("submit_request", {
      p_slug: "north-install-demo",
      p_technician_name: "Test Tech",
      p_items: [{ catalog_item_id: catalogB, quantity: 1 }],
    });
    expect(bad.error?.message).toMatch(/catalog_item_not_found/);
    const qty = await service.rpc("submit_request", {
      p_slug: "north-install-demo",
      p_technician_name: "Test Tech",
      p_items: [{ catalog_item_id: catalogA, quantity: 0 }],
    });
    expect(qty.error?.message).toMatch(/invalid_quantity/);
  });

  it("matches technicians by normalized name and derives request status for partial orders", async () => {
    const manager = await signedIn("manager@example.com");
    const submit = (name: string) =>
      service.rpc("submit_request", {
        p_slug: "north-install-demo",
        p_technician_name: name,
        p_items: [
          { catalog_item_id: catalogA, quantity: 2 },
          { custom_name: "Vitest widget", quantity: 1 },
        ],
      });
    const first = await submit("Vitest  Person");
    const second = await submit("  vitest person ");
    expect(first.error).toBeNull();
    const { data: r1 } = await service.from("requests").select("technician_id").eq("id", first.data!).single();
    const { data: r2 } = await service.from("requests").select("technician_id").eq("id", second.data!).single();
    expect(r1!.technician_id).toBe(r2!.technician_id);

    const { data: items } = await service.from("request_items").select("id, is_custom").eq("request_id", first.data!);
    const catalogLine = items!.find((i) => !i.is_custom)!;
    const customLine = items!.find((i) => i.is_custom)!;

    // Order one of two items → request stays "requested".
    const partial = await manager.rpc("mark_items_ordered", { p_team_id: teamA, p_item_ids: [catalogLine.id], p_reference: "PO-1" });
    expect(partial.data).toBe(1);
    let { data: req } = await service.from("requests").select("status, ordered_at").eq("id", first.data!).single();
    expect(req!.status).toBe("requested");
    expect(req!.ordered_at).toBeNull();

    // Removing the remaining item completes the request.
    await manager.from("request_items").update({ removed_at: new Date().toISOString() }).eq("id", customLine.id);
    ({ data: req } = await service.from("requests").select("status, ordered_at").eq("id", first.data!).single());
    expect(req!.status).toBe("ordered");
    expect(req!.ordered_at).not.toBeNull();

    // Undo → back to requested, ordered metadata cleared.
    await manager.rpc("mark_items_requested", { p_team_id: teamA, p_item_ids: [catalogLine.id] });
    const { data: line } = await service.from("request_items").select("status, ordered_at, order_batch_id").eq("id", catalogLine.id).single();
    expect(line).toEqual({ status: "requested", ordered_at: null, order_batch_id: null });
    ({ data: req } = await service.from("requests").select("status").eq("id", first.data!).single());
    expect(req!.status).toBe("requested");

    // Removing every item hides the request.
    await manager.from("request_items").update({ removed_at: new Date().toISOString() }).eq("id", catalogLine.id);
    const { data: hidden } = await service.from("requests").select("removed_at").eq("id", first.data!).single();
    expect(hidden!.removed_at).not.toBeNull();
  });

  it("rate limiter blocks after the limit", async () => {
    const key = `test:${Date.now()}`;
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { data } = await service.rpc("check_rate_limit", { p_key: key, p_limit: 3, p_window_seconds: 60 });
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
