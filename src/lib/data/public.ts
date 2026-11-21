import "server-only";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/service";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{3,63}$/;

export type PublicCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  unit: string | null;
  category_id: string | null;
  grainger_sku: string | null;
  group_id: string | null;
  attributes: Record<string, string>;
  icon: string | null;
  sort_order: number;
};

export type PublicCategory = { id: string; name: string };

export type PublicProductGroup = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category_id: string | null;
  attribute_names: string[];
  sort_order: number;
};

/** Public view of a team link: team name + active catalog. Nothing else is exposed. */
export const getPublicTeam = cache(async (slug: string) => {
  if (!SLUG_RE.test(slug)) return null;
  const supabase = createServiceClient();
  const { data: team } = await supabase
    .from("teams")
    .select("id, name, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return team;
});

export async function getPublicCatalog(teamId: string) {
  const supabase = createServiceClient();
  const [cats, items, groups] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name")
      .eq("team_id", teamId)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("catalog_items")
      .select("id, name, description, image_url, unit, category_id, grainger_sku, group_id, attributes, icon, sort_order")
      .eq("team_id", teamId)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("product_groups")
      .select("id, name, description, icon, category_id, attribute_names, sort_order")
      .eq("team_id", teamId)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
  ]);
  if (cats.error) throw cats.error;
  if (items.error) throw items.error;
  if (groups.error) throw groups.error;
  const categoryIds = new Set(cats.data.map((c) => c.id));
  const visibleCategory = (id: string | null) => (id && categoryIds.has(id) ? id : null);
  const groupById = new Map(groups.data.map((g) => [g.id, g]));
  return {
    categories: cats.data as PublicCategory[],
    groups: groups.data.map((g) => ({ ...g, category_id: visibleCategory(g.category_id) })) as PublicProductGroup[],
    // Variants of archived groups are hidden; a variant shows in its group's category.
    items: (items.data as PublicCatalogItem[])
      .filter((i) => !i.group_id || groupById.has(i.group_id))
      .map((i) => ({
        ...i,
        attributes: (i.attributes ?? {}) as Record<string, string>,
        category_id: visibleCategory(i.group_id ? (groupById.get(i.group_id)?.category_id ?? null) : i.category_id),
      })),
  };
}

export type PublicHistoryRequest = {
  id: string;
  created_at: string;
  status: "requested" | "ordered";
  ordered_at: string | null;
  note: string | null;
  items: {
    id: string;
    name: string;
    unit: string | null;
    quantity: number;
    status: "requested" | "ordered";
    ordered_at: string | null;
    is_custom: boolean;
  }[];
};

export { HISTORY_DAYS } from "@/lib/history-constants";

/** Catalog items requested most often in the last 90 days (by number of requests). */
export async function getPopularItemIds(teamId: string, limit = 5): Promise<string[]> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("request_items")
    .select("catalog_item_id")
    .eq("team_id", teamId)
    .is("removed_at", null)
    .not("catalog_item_id", "is", null)
    .gte("created_at", since)
    .limit(5000);
  if (error || !data) return [];
  const counts = new Map<string, number>();
  for (const r of data) if (r.catalog_item_id) counts.set(r.catalog_item_id, (counts.get(r.catalog_item_id) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
