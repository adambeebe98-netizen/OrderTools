import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { OutstandingItem } from "@/lib/consolidate";
import { customItemKey } from "@/lib/names";

type DB = SupabaseClient<Database>;

export type RequestStatus = "requested" | "ordered";

export type AdminRequestItem = {
  id: string;
  name: string;
  unit: string | null;
  quantity: number;
  status: RequestStatus;
  ordered_at: string | null;
  is_custom: boolean;
  catalog_item_id: string | null;
  grainger_sku: string | null;
  grainger_url: string | null;
  custom_note: string | null;
  custom_url: string | null;
  removed_at: string | null;
  order_batch_id: string | null;
};

export type AdminRequest = {
  id: string;
  technician_id: string;
  technician_name: string;
  note: string | null;
  status: RequestStatus;
  ordered_at: string | null;
  created_at: string;
  items: AdminRequestItem[];
};

const ITEM_COLS =
  "id, name, unit, quantity, status, ordered_at, is_custom, catalog_item_id, grainger_sku, grainger_url, custom_note, custom_url, removed_at, order_batch_id";

/** Remove characters with meaning in PostgREST filter syntax. */
export function sanitizeSearch(q: string) {
  return q.replace(/[%*,()\\:."']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Team member's previous visit, used for "new since last visit". */
export async function getLastSeen(db: DB, teamId: string, userId: string) {
  const { data } = await db
    .from("team_members")
    .select("last_seen_at")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  return { lastSeen: data?.last_seen_at ?? new Date(Date.now() - 86400_000).toISOString(), isMember: !!data };
}

export async function getDashboard(db: DB, teamId: string, lastSeen: string) {
  const [outstanding, newCount, recentOrdered, activity, waiting] = await Promise.all([
    db
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "requested")
      .is("removed_at", null),
    db
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .is("removed_at", null)
      .gt("created_at", lastSeen),
    db
      .from("order_batches")
      .select("id, reference, created_at, profiles(full_name, email), request_items(id, quantity, request_id)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("activity_events")
      .select("id, kind, summary, created_at, request_id")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(12),
    db
      .from("request_items")
      .select("quantity, requests!inner(technician_id, technician_name, created_at)")
      .eq("team_id", teamId)
      .eq("status", "requested")
      .is("removed_at", null),
  ]);

  const techs = new Map<string, { name: string; items: number; oldest: string }>();
  for (const row of waiting.data ?? []) {
    const r = row.requests;
    const t = techs.get(r.technician_id) ?? { name: r.technician_name, items: 0, oldest: r.created_at };
    t.items += 1;
    if (r.created_at < t.oldest) t.oldest = r.created_at;
    techs.set(r.technician_id, t);
  }

  return {
    outstandingRequests: outstanding.count ?? 0,
    outstandingItems: waiting.data?.length ?? 0,
    techniciansWaiting: [...techs.entries()]
      .map(([id, t]) => ({ id, ...t }))
      .sort((a, b) => a.oldest.localeCompare(b.oldest)),
    newSinceLastVisit: newCount.count ?? 0,
    recentBatches: (recentOrdered.data ?? []).map((b) => ({
      id: b.id,
      reference: b.reference,
      created_at: b.created_at,
      by: b.profiles?.full_name || b.profiles?.email || null,
      itemCount: b.request_items.length,
      requestCount: new Set(b.request_items.map((i) => i.request_id)).size,
    })),
    activity: activity.data ?? [],
  };
}

export type RequestFilters = {
  status: "requested" | "ordered" | "all";
  technician?: string;
  q?: string;
  sort: "newest" | "oldest";
  page: number;
};

export const PAGE_SIZE = 50;

export async function getRequests(db: DB, teamId: string, f: RequestFilters) {
  let query = db
    .from("requests")
    .select(`id, technician_id, technician_name, note, status, ordered_at, created_at, request_items(${ITEM_COLS})`, {
      count: "exact",
    })
    .eq("team_id", teamId)
    .is("removed_at", null);

  if (f.status !== "all") query = query.eq("status", f.status);
  if (f.technician) query = query.eq("technician_id", f.technician);

  const q = f.q ? sanitizeSearch(f.q) : "";
  if (q) {
    const { data: matches } = await db
      .from("request_items")
      .select("request_id")
      .eq("team_id", teamId)
      .is("removed_at", null)
      .ilike("name", `%${q}%`)
      .limit(500);
    const ids = [...new Set((matches ?? []).map((m) => m.request_id))];
    query = ids.length
      ? query.or(`technician_name.ilike.%${q}%,id.in.(${ids.join(",")})`)
      : query.ilike("technician_name", `%${q}%`);
  }

  const from = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: f.sort === "oldest" })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;

  return {
    total: count ?? 0,
    requests: (data ?? []).map(
      (r): AdminRequest => ({
        ...r,
        status: r.status as RequestStatus,
        items: (r.request_items as AdminRequestItem[]).filter((i) => !i.removed_at),
      }),
    ),
  };
}

export async function getRequest(db: DB, teamId: string, requestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return null;
  const { data } = await db
    .from("requests")
    .select(
      `id, technician_id, technician_name, note, status, ordered_at, created_at, removed_at, request_items(${ITEM_COLS}, created_at, order_batches(reference))`,
    )
    .eq("team_id", teamId)
    .eq("id", requestId)
    .maybeSingle();
  if (!data) return null;
  const items = [...data.request_items].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { ...data, request_items: items };
}

export async function getTechnicianOptions(db: DB, teamId: string) {
  const { data } = await db
    .from("technicians")
    .select("id, name, archived_at")
    .eq("team_id", teamId)
    .order("name");
  return data ?? [];
}

/** All outstanding (requested, not removed) items — the input to the shopping list. */
export async function getOutstandingItems(db: DB, teamId: string): Promise<OutstandingItem[]> {
  const { data, error } = await db
    .from("request_items")
    .select(
      "id, request_id, catalog_item_id, name, unit, grainger_sku, grainger_url, quantity, is_custom, custom_note, custom_url, requests!inner(created_at, technician_id, technician_name, removed_at)",
    )
    .eq("team_id", teamId)
    .eq("status", "requested")
    .is("removed_at", null)
    .is("requests.removed_at", null)
    .limit(5000);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    request_id: row.request_id,
    request_created_at: row.requests.created_at,
    technician_id: row.requests.technician_id,
    technician_name: row.requests.technician_name,
    catalog_item_id: row.catalog_item_id,
    name: row.name,
    unit: row.unit,
    grainger_sku: row.grainger_sku,
    grainger_url: row.grainger_url,
    quantity: row.quantity,
    is_custom: row.is_custom,
    custom_note: row.custom_note,
    custom_url: row.custom_url,
  }));
}

export async function getCatalog(db: DB, teamId: string) {
  const [cats, items] = await Promise.all([
    db.from("categories").select("id, name, sort_order, archived_at").eq("team_id", teamId).order("sort_order").order("name"),
    db
      .from("catalog_items")
      .select("id, name, description, image_url, unit, grainger_sku, grainger_url, category_id, sort_order, archived_at, updated_at")
      .eq("team_id", teamId)
      .order("name"),
  ]);
  return { categories: cats.data ?? [], items: items.data ?? [] };
}

export type CustomItemSummary = {
  key: string;
  name: string;
  requestCount: number;
  totalQuantity: number;
  technicians: string[];
  lastRequested: string;
  notes: string[];
  links: string[];
  itemIds: string[];
};

/** Frequently requested "other" items that aren't linked to a catalog product yet. */
export async function getCustomItemSummary(db: DB, teamId: string): Promise<CustomItemSummary[]> {
  const since = new Date(Date.now() - 365 * 86400_000).toISOString();
  const { data } = await db
    .from("request_items")
    .select("id, name, quantity, custom_note, custom_url, created_at, requests!inner(technician_name)")
    .eq("team_id", teamId)
    .eq("is_custom", true)
    .is("catalog_item_id", null)
    .is("removed_at", null)
    .gte("created_at", since)
    .limit(2000);

  const map = new Map<string, CustomItemSummary>();
  for (const row of data ?? []) {
    const key = customItemKey(row.name);
    const s =
      map.get(key) ??
      ({ key, name: row.name, requestCount: 0, totalQuantity: 0, technicians: [], lastRequested: row.created_at, notes: [], links: [], itemIds: [] } as CustomItemSummary);
    s.requestCount += 1;
    s.totalQuantity += row.quantity;
    s.itemIds.push(row.id);
    if (!s.technicians.includes(row.requests.technician_name)) s.technicians.push(row.requests.technician_name);
    if (row.created_at > s.lastRequested) s.lastRequested = row.created_at;
    if (row.custom_note && s.notes.length < 3 && !s.notes.includes(row.custom_note)) s.notes.push(row.custom_note);
    if (row.custom_url && s.links.length < 3 && !s.links.includes(row.custom_url)) s.links.push(row.custom_url);
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => b.requestCount - a.requestCount || b.lastRequested.localeCompare(a.lastRequested));
}

export async function getTechnicianStats(db: DB, teamId: string) {
  const [techs, reqs] = await Promise.all([
    db.from("technicians").select("id, name, archived_at, last_request_at, created_at").eq("team_id", teamId).order("name"),
    db.from("requests").select("technician_id, status").eq("team_id", teamId).is("removed_at", null),
  ]);
  const stats = new Map<string, { total: number; open: number }>();
  for (const r of reqs.data ?? []) {
    const s = stats.get(r.technician_id) ?? { total: 0, open: 0 };
    s.total += 1;
    if (r.status === "requested") s.open += 1;
    stats.set(r.technician_id, s);
  }
  return (techs.data ?? []).map((t) => ({ ...t, ...(stats.get(t.id) ?? { total: 0, open: 0 }) }));
}
