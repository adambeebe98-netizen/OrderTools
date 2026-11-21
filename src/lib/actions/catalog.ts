"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { catalogItemSchema, categoryNameSchema, type CatalogItemInput } from "@/lib/validation";
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
      .insert({ ...parsed.data, team_id: teamId })
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
  name: z.string(),
  category: z.string().nullable(),
  unit: z.string().nullable(),
  description: z.string().nullable(),
  grainger_sku: z.string().nullable(),
  grainger_url: z.string().nullable(),
  image_url: z.string().nullable(),
});

/**
 * Bulk import. Rows match existing items by Grainger SKU first, then by name
 * (case-insensitive); matches are updated, everything else is created.
 * Categories are created on the fly.
 */
export async function importCatalog(
  teamId: string,
  rows: CatalogImportRow[],
): Promise<ActionResult & { created?: number; updated?: number; skipped?: number }> {
  const list = z.array(importRowSchema).max(MAX_IMPORT_ROWS).safeParse(rows);
  if (!list.success) return { ok: false, error: "The file has too many rows or invalid data." };
  const { supabase } = await requireTeam(teamId);

  const [{ data: cats }, { data: existing }] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").eq("team_id", teamId),
    supabase.from("catalog_items").select("id, name, grainger_sku").eq("team_id", teamId),
  ]);
  const catByName = new Map((cats ?? []).map((c) => [c.name.toLowerCase(), c.id]));
  let nextOrder = Math.max(-1, ...(cats ?? []).map((c) => c.sort_order)) + 1;
  const bySku = new Map((existing ?? []).filter((i) => i.grainger_sku).map((i) => [i.grainger_sku!.toLowerCase(), i.id]));
  const byName = new Map((existing ?? []).map((i) => [i.name.toLowerCase(), i.id]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
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
          .insert({ team_id: teamId, name: catName, sort_order: nextOrder++ })
          .select("id")
          .single();
        if (data) {
          categoryId = data.id;
          catByName.set(catName.toLowerCase(), data.id);
        }
      }
    }
    const values = { ...parsed.data, category_id: categoryId };
    const matchId =
      (values.grainger_sku && bySku.get(values.grainger_sku.toLowerCase())) || byName.get(values.name.toLowerCase());
    if (matchId) {
      const { error } = await supabase
        .from("catalog_items")
        .update({ ...values, archived_at: null })
        .eq("id", matchId)
        .eq("team_id", teamId);
      if (error) skipped++;
      else updated++;
    } else {
      const { data, error } = await supabase.from("catalog_items").insert({ ...values, team_id: teamId }).select("id").single();
      if (error || !data) skipped++;
      else {
        created++;
        byName.set(values.name.toLowerCase(), data.id);
        if (values.grainger_sku) bySku.set(values.grainger_sku.toLowerCase(), data.id);
      }
    }
  }
  refresh(teamId);
  return { ok: true, created, updated, skipped };
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
