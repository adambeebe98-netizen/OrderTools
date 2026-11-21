/**
 * Runs the real production script (supabase/catalog-reorganize.sql) against a
 * team set up exactly like production before the change: flat catalog, real
 * requests (including one for the obsolete short bit) and a Grainger SKU.
 * Requires the local Supabase stack and the `psql` client; skipped otherwise.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const URL = process.env.TEST_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE =
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function psqlAvailable() {
  try {
    execFileSync("psql", [DB_URL, "-tAc", "select 1"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
const ready = psqlAvailable();

function runScript(slug: string) {
  const sql = readFileSync("supabase/catalog-reorganize.sql", "utf8").replace("v_team_slug text := null", `v_team_slug text := '${slug}'`);
  return execFileSync("psql", [DB_URL, "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, stdio: "pipe" }).toString();
}

const FLAT: [string, string, string][] = [
  ['Long Wood Bit 1/4"', "Drill Bits", "each"],
  ['Short Wood Bit 1/4"', "Drill Bits", "each"],
  ['Short Wood Bit 3/8"', "Drill Bits", "each"],
  ['Long Masonry Bit 3/8"', "Drill Bits", "each"],
  ['Extra-Long Masonry Bit 1/2"', "Drill Bits", "each"],
  ['Hole Saw Bit 3/4"', "Drill Bits", "each"],
  ["Zip Ties", "Wiring & Connectors", "bag"],
  ["Dolphin Beans", "Wiring & Connectors", "bag"],
];

describe.skipIf(!ready)("catalog reorganization script", () => {
  const db = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
  const slug = `mig-test-${Date.now().toString(36)}`;
  let teamId = "";
  const ids = new Map<string, string>();
  let requestId = "";

  beforeAll(async () => {
    const { data: team } = await db.from("teams").insert({ name: "Migration Test", slug }).select("id").single();
    teamId = team!.id;
    const cats = new Map<string, string>();
    for (const [name, cat, unit] of FLAT) {
      if (!cats.has(cat)) {
        const { data } = await db.from("categories").insert({ team_id: teamId, name: cat }).select("id").single();
        cats.set(cat, data!.id);
      }
      const { data } = await db
        .from("catalog_items")
        .insert({ team_id: teamId, name, unit, category_id: cats.get(cat)! })
        .select("id")
        .single();
      ids.set(name, data!.id);
    }
    await db.from("catalog_items").update({ grainger_sku: "SKU-38" }).eq("id", ids.get('Long Masonry Bit 3/8"')!);
    const { data } = await db.rpc("submit_request", {
      p_slug: slug,
      p_technician_name: "Pre Migration",
      p_items: [
        { catalog_item_id: ids.get('Short Wood Bit 1/4"'), quantity: 2 },
        { catalog_item_id: ids.get('Long Masonry Bit 3/8"'), quantity: 4 },
        { catalog_item_id: ids.get("Zip Ties"), quantity: 1 },
      ],
    });
    requestId = data!;
  });

  it("groups variants, keeps ids/SKUs, archives the obsolete bit, leaves requests untouched", async () => {
    const before = await db.from("request_items").select("id, catalog_item_id, name, grainger_sku, quantity").eq("request_id", requestId).order("id");
    const out = runScript(slug);
    expect(out).not.toMatch(/ERROR/);

    const { data: groups } = await db.from("product_groups").select("name, attribute_names, icon").eq("team_id", teamId).order("sort_order");
    expect(groups!.map((g) => g.name)).toEqual(["Short Bit", "Long Bit", "Extra-Long Bit", "Hole Saw", "Speedbor"]);
    expect(groups![0].attribute_names).toEqual(["Type", "Size"]);

    const { data: masonry } = await db.from("catalog_items").select("id, name, grainger_sku, attributes, group_id").eq("id", ids.get('Long Masonry Bit 3/8"')!).single();
    expect(masonry).toMatchObject({ name: 'Long Bit — Masonry — 3/8"', grainger_sku: "SKU-38", attributes: { Type: "Masonry", Size: '3/8"' } });

    const { data: obsolete } = await db.from("catalog_items").select("archived_at, group_id").eq("id", ids.get('Short Wood Bit 1/4"')!).single();
    expect(obsolete!.archived_at).not.toBeNull();
    expect(obsolete!.group_id).toBeNull();

    // Missing variants are created (Short Bit Masonry 1/4" didn't exist before).
    const { data: created } = await db.from("catalog_items").select("name").eq("team_id", teamId).eq("name", 'Short Bit — Masonry — 1/4"');
    expect(created).toHaveLength(1);

    const { data: zip } = await db.from("catalog_items").select("id, icon, group_id").eq("id", ids.get("Zip Ties")!).single();
    expect(zip).toMatchObject({ icon: "zip-tie", group_id: null });

    const after = await db.from("request_items").select("id, catalog_item_id, name, grainger_sku, quantity").eq("request_id", requestId).order("id");
    expect(after.data).toEqual(before.data);
  });

  it("is safe to run again (no duplicates, nothing changes)", async () => {
    const snapshot = async () =>
      (await db.from("catalog_items").select("id, name, group_id, attributes, archived_at").eq("team_id", teamId).order("id")).data;
    const first = await snapshot();
    runScript(slug);
    expect(await snapshot()).toEqual(first);
    const { count } = await db.from("product_groups").select("id", { count: "exact", head: true }).eq("team_id", teamId);
    expect(count).toBe(5);
  });

  it("prevents duplicate active variants and blocks ordering from archived groups", async () => {
    const { data: g } = await db.from("product_groups").select("id").eq("team_id", teamId).eq("name", "Hole Saw").single();
    const dup = await db
      .from("catalog_items")
      .insert({ team_id: teamId, group_id: g!.id, attributes: { Size: '3/4"' }, name: "dup" });
    expect(dup.error?.code).toBe("23505");

    const { data: hs } = await db.from("catalog_items").select("id").eq("group_id", g!.id).single();
    await db.from("product_groups").update({ archived_at: new Date().toISOString() }).eq("id", g!.id);
    const res = await db.rpc("submit_request", { p_slug: slug, p_technician_name: "X", p_items: [{ catalog_item_id: hs!.id, quantity: 1 }] });
    expect(res.error?.message).toMatch(/catalog_item_not_found/);
    await db.from("product_groups").update({ archived_at: null }).eq("id", g!.id);
  });

  it("orders a variant by its exact id and snapshots the variant name", async () => {
    const { data: v } = await db.from("catalog_items").select("id").eq("team_id", teamId).eq("name", 'Long Bit — Masonry — 3/8"').single();
    const { data: rid } = await db.rpc("submit_request", { p_slug: slug, p_technician_name: "Post", p_items: [{ catalog_item_id: v!.id, quantity: 4 }] });
    const { data: line } = await db.from("request_items").select("name, grainger_sku, quantity, catalog_item_id").eq("request_id", rid!).single();
    expect(line).toEqual({ name: 'Long Bit — Masonry — 3/8"', grainger_sku: "SKU-38", quantity: 4, catalog_item_id: v!.id });
  });
});
