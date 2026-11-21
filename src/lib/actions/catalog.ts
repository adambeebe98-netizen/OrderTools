"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  catalogItemSchema,
  categoryNameSchema,
  productGroupSchema,
  variantSchema,
  type CatalogItemInput,
  type ProductGroupInput,
  type VariantInput,
} from "@/lib/validation";
import { MAX_ATTRIBUTES, cleanAttributes, sameAttributes, variantName, type Attributes } from "@/lib/variants";
import { MAX_IMPORT_ROWS, type CatalogImportRow } from "@/lib/csv";
import type { ActionResult } from "@/lib/actions/requests";

const uuid = z.string().uuid();

function refresh(teamId: string) {
  revalidatePath(`/admin/${teamId}/catalog`);
  revalidatePath(`/admin/${teamId}/shopping-list`);
}

export async function saveCatalogItem(
  teamId: string,
  itemId: string | null,
  input: CatalogItemInput,
  linkCustomItemIds?: string[],
): Promise<ActionResult & { id?: string }> {
  const parsed = catalogItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (itemId && !uuid.safeParse(itemId).success) return { ok: false, error: "Invalid item." };
  const { supabase } = await requireTeam(teamId);

  let id = itemId;
  if (itemId) {
    const { error } = await supabase.from("catalog_items").update(parsed.data).eq("id", itemId).eq("team_id", teamId);
    if (error) return { ok: false, error: "Could not save item." };
  } else {
    const { data, error } = await supabase
      .from("catalog_items")
      .insert({ ...parsed.data, team_id: teamId, sort_order: await nextSortOrder(supabase, teamId, parsed.data.category_id) })
      .select("id")
      .single();
    if (error) return { ok: false, error: "Could not create item." };
    id = data.id;
  }

  // Converting custom requests: link past "other" items to the new product so
  // they consolidate with it and drop out of the review list.
  const links = z.array(uuid).max(2000).safeParse(linkCustomItemIds ?? []);
  if (id && links.success && links.data.length) {
    await supabase
      .from("request_items")
      .update({ catalog_item_id: id })
      .eq("team_id", teamId)
      .eq("is_custom", true)
      .in("id", links.data);
    // Outstanding ones also pick up the product's name/SKU/link for ordering.
    await supabase
      .from("request_items")
      .update({
        name: parsed.data.name,
        unit: parsed.data.unit,
        grainger_sku: parsed.data.grainger_sku,
        grainger_url: parsed.data.grainger_url,
      })
      .eq("team_id", teamId)
      .eq("status", "requested")
      .in("id", links.data);
  }

  refresh(teamId);
  return { ok: true, id: id ?? undefined };
}

export async function setCatalogItemArchived(teamId: string, itemId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return { ok: false, error: "Invalid item." };
  const { supabase } = await requireTeam(teamId);
  const { error } = await supabase
    .from("catalog_items")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", itemId)
    .eq("team_id", teamId);
  if (error) return { ok: false, error: "Could not update item." };
  refresh(teamId);
  return { ok: true };
}

export async function createCategory(teamId: string, name: string): Promise<ActionResult> {
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase } = await requireTeam(teamId);
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .eq("team_id", teamId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("categories")
    .insert({ team_id: teamId, name: parsed.data, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) return { ok: false, error: error.code === "23505" ? "A category with that name already exists." : "Could not create category." };
  refresh(teamId);
  return { ok: true };
}

export async function updateCategory(
  teamId: string,
  categoryId: string,
  patch: { name?: string; archived?: boolean },
): Promise<ActionResult> {
  if (!uuid.safeParse(categoryId).success) return { ok: false, error: "Invalid category." };
  const update: { name?: string; archived_at?: string | null } = {};
  if (patch.name !== undefined) {
    const parsed = categoryNameSchema.safeParse(patch.name);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    update.name = parsed.data;
  }
  if (patch.archived !== undefined) update.archived_at = patch.archived ? new Date().toISOString() : null;
  const { supabase } = await requireTeam(teamId);
  const { error } = await supabase.from("categories").update(update).eq("id", categoryId).eq("team_id", teamId);
  if (error) return { ok: false, error: error.code === "23505" ? "A category with that name already exists." : "Could not update category." };
  refresh(teamId);
  return { ok: true };
}

/** Persist a new category order (array of category ids, first = top). */
export async function reorderCategories(teamId: string, orderedIds: string[]): Promise<ActionResult> {
  const ids = z.array(uuid).max(500).safeParse(orderedIds);
  if (!ids.success) return { ok: false, error: "Invalid order." };
  const { supabase } = await requireTeam(teamId);
  const results = await Promise.all(
    ids.data.map((id, index) => supabase.from("categories").update({ sort_order: index }).eq("id", id).eq("team_id", teamId)),
  );
  if (results.some((r) => r.error)) return { ok: false, error: "Could not save order." };
  refresh(teamId);
  return { ok: true };
}

const importRowSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string(),
  category: z.string().nullable(),
  group: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  attribute_names: z.array(z.string()).optional(),
  icon: z.string().nullable().optional(),
  unit: z.string().nullable(),
  description: z.string().nullable(),
  grainger_sku: z.string().nullable(),
  grainger_url: z.string().nullable(),
  image_url: z.string().nullable(),
});

/**
 * Bulk import. Matching (to preserve IDs and prevent duplicates), in order:
 *   1. `id` column (from a previous export)
 *   2. same product group + same options
 *   3. same Grainger SKU
 *   4. same name (items without a group)
 * Matches are updated, everything else is created. Categories and product
 * groups are created on the fly; new option names are appended to a group.
 */
export async function importCatalog(
  teamId: string,
  rows: CatalogImportRow[],
): Promise<ActionResult & { created?: number; updated?: number; skipped?: number; problems?: string[] }> {
  const list = z.array(importRowSchema).max(MAX_IMPORT_ROWS).safeParse(rows);
  if (!list.success) return { ok: false, error: "The file has too many rows or invalid data." };
  const { supabase } = await requireTeam(teamId);

  const [{ data: cats }, { data: existing }, { data: groups }] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").eq("team_id", teamId),
    supabase.from("catalog_items").select("id, name, grainger_sku, group_id, attributes, archived_at").eq("team_id", teamId),
    supabase.from("product_groups").select("id, name, attribute_names, category_id, sort_order").eq("team_id", teamId).is("archived_at", null),
  ]);
  const catByName = new Map((cats ?? []).map((c) => [c.name.toLowerCase(), c.id]));
  let nextCatOrder = Math.max(-1, ...(cats ?? []).map((c) => c.sort_order)) + 1;
  const items = (existing ?? []).map((i) => ({ ...i, attributes: (i.attributes ?? {}) as Attributes }));
  const groupByName = new Map((groups ?? []).map((g) => [g.name.toLowerCase(), g]));
  let nextEntryOrder = Math.max(0, ...(groups ?? []).map((g) => g.sort_order + 1));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const problems: string[] = [];

  for (const raw of list.data) {
    const parsed = catalogItemSchema.safeParse(raw);
    if (!parsed.success) {
      skipped++;
      continue;
    }
    let categoryId: string | null = null;
    const catName = raw.category?.trim().slice(0, 60);
    if (catName) {
      categoryId = catByName.get(catName.toLowerCase()) ?? null;
      if (!categoryId) {
        const { data } = await supabase
          .from("categories")
          .insert({ team_id: teamId, name: catName, sort_order: nextCatOrder++ })
          .select("id")
          .single();
        if (data) {
          categoryId = data.id;
          catByName.set(catName.toLowerCase(), data.id);
        }
      }
    }

    // Product group (optional).
    let group: { id: string; name: string; attribute_names: string[] } | null = null;
    let attributes: Attributes = {};
    const groupName = raw.group?.trim().slice(0, 80);
    if (groupName) {
      const wanted = raw.attribute_names?.length ? raw.attribute_names : Object.keys(raw.attributes ?? {});
      let g = groupByName.get(groupName.toLowerCase());
      if (!g) {
        const { data, error } = await supabase
          .from("product_groups")
          .insert({
            team_id: teamId,
            name: groupName,
            category_id: categoryId,
            icon: parsed.data.icon,
            attribute_names: wanted.slice(0, MAX_ATTRIBUTES),
            sort_order: nextEntryOrder++,
          })
          .select("id, name, attribute_names, category_id, sort_order")
          .single();
        if (error || !data) {
          skipped++;
          problems.push(`${raw.name}: could not create group ${groupName}`);
          continue;
        }
        g = data;
        groupByName.set(groupName.toLowerCase(), data);
      } else {
        const missing = wanted.filter((n) => !g!.attribute_names.includes(n));
        if (missing.length) {
          const names = [...g.attribute_names, ...missing].slice(0, MAX_ATTRIBUTES);
          await supabase.from("product_groups").update({ attribute_names: names }).eq("id", g.id).eq("team_id", teamId);
          g = { ...g, attribute_names: names };
          groupByName.set(groupName.toLowerCase(), g);
        }
      }
      group = g;
      attributes = cleanAttributes(g.attribute_names, raw.attributes ?? {});
      if (Object.keys(attributes).length === 0) {
        skipped++;
        problems.push(`${raw.name}: products in a group need options, e.g. "Size: 3/8\""`);
        continue;
      }
    }

    const name = group ? variantName(group.name, group.attribute_names, attributes) : parsed.data.name;
    const values = {
      name,
      description: parsed.data.description,
      unit: parsed.data.unit,
      grainger_sku: parsed.data.grainger_sku,
      grainger_url: parsed.data.grainger_url,
      image_url: parsed.data.image_url,
      category_id: categoryId,
      group_id: group?.id ?? null,
      attributes,
      icon: group ? null : parsed.data.icon,
    };

    const sku = values.grainger_sku?.toLowerCase();
    const match =
      (raw.id && items.find((i) => i.id === raw.id)) ||
      (group && items.find((i) => i.group_id === group!.id && sameAttributes(i.attributes, attributes))) ||
      (sku && items.find((i) => i.grainger_sku?.toLowerCase() === sku)) ||
      (!group && items.find((i) => !i.group_id && i.name.toLowerCase() === name.toLowerCase())) ||
      null;

    if (match) {
      const { error } = await supabase
        .from("catalog_items")
        .update({ ...values, archived_at: null })
        .eq("id", match.id)
        .eq("team_id", teamId);
      if (error) {
        skipped++;
        problems.push(`${name}: ${error.code === "23505" ? "duplicate of another variant" : "could not update"}`);
      } else {
        updated++;
        Object.assign(match, values, { archived_at: null });
      }
    } else {
      const { data, error } = await supabase.from("catalog_items").insert({ ...values, team_id: teamId }).select("id").single();
      if (error || !data) {
        skipped++;
        problems.push(`${name}: ${error?.code === "23505" ? "duplicate of another variant" : "could not create"}`);
      } else {
        created++;
        items.push({ id: data.id, name, grainger_sku: values.grainger_sku, group_id: values.group_id, attributes, archived_at: null });
      }
    }
  }
  refresh(teamId);
  return { ok: true, created, updated, skipped, problems: problems.slice(0, 20) };
}

// ----- Product groups & variants -------------------------------------------

/** Create or update a product group. Renaming options carries existing variants' values over by position. */
export async function saveProductGroup(
  teamId: string,
  groupId: string | null,
  input: ProductGroupInput,
): Promise<ActionResult & { id?: string }> {
  const parsed = productGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (groupId && !uuid.safeParse(groupId).success) return { ok: false, error: "Invalid group." };
  const { supabase } = await requireTeam(teamId);
  const g = parsed.data;

  if (!groupId) {
    const order = await nextSortOrder(supabase, teamId, g.category_id);
    const { data, error } = await supabase
      .from("product_groups")
      .insert({ ...g, team_id: teamId, sort_order: order })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.code === "23505" ? "A product group with that name already exists." : "Could not create group." };
    refresh(teamId);
    return { ok: true, id: data.id };
  }

  const { data: before } = await supabase
    .from("product_groups")
    .select("attribute_names")
    .eq("id", groupId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!before) return { ok: false, error: "Group not found." };

  const { error } = await supabase.from("product_groups").update(g).eq("id", groupId).eq("team_id", teamId);
  if (error) return { ok: false, error: error.code === "23505" ? "A product group with that name already exists." : "Could not save group." };

  // Re-derive variant names/attributes and keep variants in the group's category.
  const { data: variants } = await supabase.from("catalog_items").select("id, attributes").eq("group_id", groupId).eq("team_id", teamId);
  for (const v of variants ?? []) {
    const old = (v.attributes ?? {}) as Attributes;
    const remapped: Attributes = {};
    g.attribute_names.forEach((n, i) => {
      const value = old[n] ?? old[before.attribute_names[i]];
      if (value) remapped[n] = value;
    });
    const { error: vErr } = await supabase
      .from("catalog_items")
      .update({ attributes: remapped, name: variantName(g.name, g.attribute_names, remapped), category_id: g.category_id })
      .eq("id", v.id)
      .eq("team_id", teamId);
    if (vErr) {
      refresh(teamId);
      return { ok: false, error: "Saved, but two variants now have the same options. Edit them so each is different." };
    }
  }
  refresh(teamId);
  return { ok: true, id: groupId };
}

export async function setProductGroupArchived(teamId: string, groupId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success) return { ok: false, error: "Invalid group." };
  const { supabase } = await requireTeam(teamId);
  const { error } = await supabase
    .from("product_groups")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", groupId)
    .eq("team_id", teamId);
  if (error) return { ok: false, error: error.code === "23505" ? "An active group with that name already exists." : "Could not update group." };
  refresh(teamId);
  return { ok: true };
}

/** Delete a group only when it has no variants left (archive otherwise). */
export async function deleteProductGroup(teamId: string, groupId: string): Promise<ActionResult> {
  if (!uuid.safeParse(groupId).success) return { ok: false, error: "Invalid group." };
  const { supabase } = await requireTeam(teamId);
  const { count } = await supabase.from("catalog_items").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("team_id", teamId);
  if (count) return { ok: false, error: "Remove or move its variants first, or archive the group instead." };
  const { error } = await supabase.from("product_groups").delete().eq("id", groupId).eq("team_id", teamId);
  if (error) return { ok: false, error: "Could not delete group." };
  refresh(teamId);
  return { ok: true };
}

/** Create or update one purchasable variant of a group. Its name is derived from the group + options. */
export async function saveVariant(
  teamId: string,
  groupId: string,
  variantId: string | null,
  input: VariantInput,
): Promise<ActionResult & { id?: string }> {
  const parsed = variantSchema.safeParse(input);
  if (!uuid.safeParse(groupId).success || (variantId && !uuid.safeParse(variantId).success)) return { ok: false, error: "Invalid input." };
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase } = await requireTeam(teamId);
  const { data: group } = await supabase
    .from("product_groups")
    .select("id, name, attribute_names, category_id")
    .eq("id", groupId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Group not found." };

  const attributes = cleanAttributes(group.attribute_names, parsed.data.attributes);
  const missing = group.attribute_names.filter((n) => !attributes[n]);
  if (missing.length === group.attribute_names.length) return { ok: false, error: `Enter ${group.attribute_names.join(" / ")}.` };

  const values = {
    group_id: group.id,
    category_id: group.category_id,
    attributes,
    name: variantName(group.name, group.attribute_names, attributes),
    unit: parsed.data.unit,
    description: parsed.data.description,
    grainger_sku: parsed.data.grainger_sku,
    grainger_url: parsed.data.grainger_url,
    image_url: parsed.data.image_url,
    icon: null,
  };

  if (variantId) {
    const { error } = await supabase.from("catalog_items").update(values).eq("id", variantId).eq("team_id", teamId);
    if (error) return { ok: false, error: error.code === "23505" ? "A variant with these options already exists." : "Could not save variant." };
    refresh(teamId);
    return { ok: true, id: variantId };
  }
  const { data: last } = await supabase
    .from("catalog_items")
    .select("sort_order")
    .eq("group_id", group.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("catalog_items")
    .insert({ ...values, team_id: teamId, sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? "A variant with these options already exists." : "Could not create variant." };
  refresh(teamId);
  return { ok: true, id: data.id };
}

/** Permanently delete an item that has never been requested. Requested items must be archived instead. */
export async function deleteCatalogItem(teamId: string, itemId: string): Promise<ActionResult> {
  if (!uuid.safeParse(itemId).success) return { ok: false, error: "Invalid item." };
  const { supabase } = await requireTeam(teamId);
  const { count } = await supabase
    .from("request_items")
    .select("id", { count: "exact", head: true })
    .eq("catalog_item_id", itemId)
    .eq("team_id", teamId);
  if (count) return { ok: false, error: "This has been requested before, so it can only be archived (history stays accurate)." };
  const { error } = await supabase.from("catalog_items").delete().eq("id", itemId).eq("team_id", teamId);
  if (error) return { ok: false, error: "Could not delete." };
  refresh(teamId);
  return { ok: true };
}

/**
 * Persist display order. `entries` are the groups and standalone items of one
 * category (or the variants of one group) in their new order.
 */
export async function reorderEntries(
  teamId: string,
  entries: { kind: "group" | "item"; id: string }[],
): Promise<ActionResult> {
  const list = z
    .array(z.object({ kind: z.enum(["group", "item"]), id: z.string().uuid() }))
    .max(500)
    .safeParse(entries);
  if (!list.success) return { ok: false, error: "Invalid order." };
  const { supabase } = await requireTeam(teamId);
  const results = await Promise.all(
    list.data.map((e, index) =>
      supabase
        .from(e.kind === "group" ? "product_groups" : "catalog_items")
        .update({ sort_order: index })
        .eq("id", e.id)
        .eq("team_id", teamId),
    ),
  );
  if (results.some((r) => r.error)) return { ok: false, error: "Could not save order." };
  refresh(teamId);
  return { ok: true };
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof requireTeam>>["supabase"],
  teamId: string,
  categoryId: string | null,
) {
  const g = supabase.from("product_groups").select("sort_order").eq("team_id", teamId);
  const i = supabase.from("catalog_items").select("sort_order").eq("team_id", teamId).is("group_id", null);
  const [{ data: gs }, { data: is }] = await Promise.all([
    categoryId ? g.eq("category_id", categoryId) : g.is("category_id", null),
    categoryId ? i.eq("category_id", categoryId) : i.is("category_id", null),
  ]);
  return Math.max(-1, ...(gs ?? []).map((r) => r.sort_order), ...(is ?? []).map((r) => r.sort_order)) + 1;
}

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Upload a product image to Supabase Storage after verifying team access. */
export async function uploadCatalogImage(teamId: string, formData: FormData): Promise<ActionResult & { url?: string }> {
  await requireTeam(teamId);
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose an image." };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { ok: false, error: "Use a PNG, JPEG, WebP, or GIF image." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Images must be 2 MB or smaller." };

  const service = createServiceClient();
  const path = `${teamId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await service.storage
    .from("catalog-images")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000" });
  if (error) return { ok: false, error: "Upload failed." };
  const { data } = service.storage.from("catalog-images").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
