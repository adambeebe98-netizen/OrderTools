"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";

export type ActionResult = { ok: true; message?: string; count?: number } | { ok: false; error: string };

const uuid = z.string().uuid();
const uuidList = z.array(uuid).min(1).max(5000);

function refresh(teamId: string) {
  revalidatePath(`/admin/${teamId}`, "layout");
}

export async function markItemsOrdered(teamId: string, itemIds: string[], reference?: string): Promise<ActionResult> {
  const ids = uuidList.safeParse(itemIds);
  const ref = z.string().trim().max(80).optional().safeParse(reference);
  if (!ids.success || !ref.success) return { ok: false, error: "Nothing selected." };
  const { supabase } = await requireTeam(teamId);
  const { data, error } = await supabase.rpc("mark_items_ordered", {
    p_team_id: teamId,
    p_item_ids: ids.data,
    p_reference: ref.data || undefined,
  });
  if (error) return { ok: false, error: "Could not mark items as ordered." };
  refresh(teamId);
  return { ok: true, count: data ?? 0 };
}

/** Mark every outstanding item on the given requests as ordered. */
export async function markRequestsOrdered(teamId: string, requestIds: string[], reference?: string): Promise<ActionResult> {
  const ids = uuidList.safeParse(requestIds);
  if (!ids.success) return { ok: false, error: "Nothing selected." };
  const { supabase } = await requireTeam(teamId);
  const { data: items, error } = await supabase
    .from("request_items")
    .select("id")
    .eq("team_id", teamId)
    .in("request_id", ids.data)
    .eq("status", "requested")
    .is("removed_at", null);
  if (error) return { ok: false, error: "Could not load items." };
  if (!items.length) return { ok: true, count: 0 };
  return markItemsOrdered(teamId, items.map((i) => i.id), reference);
}

export async function markItemsRequested(teamId: string, itemIds: string[]): Promise<ActionResult> {
  const ids = uuidList.safeParse(itemIds);
  if (!ids.success) return { ok: false, error: "Nothing selected." };
  const { supabase } = await requireTeam(teamId);
  const { data, error } = await supabase.rpc("mark_items_requested", { p_team_id: teamId, p_item_ids: ids.data });
  if (error) return { ok: false, error: "Could not update items." };
  refresh(teamId);
  return { ok: true, count: data ?? 0 };
}

const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999).optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function updateRequestItem(
  teamId: string,
  itemId: string,
  patch: { quantity?: number; name?: string },
): Promise<ActionResult> {
  const id = uuid.safeParse(itemId);
  const p = updateItemSchema.safeParse(patch);
  if (!id.success || !p.success) return { ok: false, error: "Quantity must be between 1 and 999." };
  const { supabase, user } = await requireTeam(teamId);

  const { data: before } = await supabase
    .from("request_items")
    .select("name, quantity, is_custom, request_id")
    .eq("id", id.data)
    .eq("team_id", teamId)
    .maybeSingle();
  if (!before) return { ok: false, error: "Item not found." };

  const update: { quantity?: number; name?: string } = {};
  if (p.data.quantity !== undefined) update.quantity = p.data.quantity;
  // Only custom items can be renamed; catalog items keep their product name.
  if (p.data.name !== undefined && before.is_custom) update.name = p.data.name;
  if (!Object.keys(update).length) return { ok: true };

  const { error } = await supabase.from("request_items").update(update).eq("id", id.data).eq("team_id", teamId);
  if (error) return { ok: false, error: "Could not save." };

  const changes = [
    update.quantity !== undefined && update.quantity !== before.quantity ? `qty ${before.quantity} → ${update.quantity}` : null,
    update.name && update.name !== before.name ? `renamed to “${update.name}”` : null,
  ].filter(Boolean);
  if (changes.length) {
    await supabase.from("activity_events").insert({
      team_id: teamId,
      request_id: before.request_id,
      actor_id: user.id,
      kind: "item_edited",
      summary: `Edited ${before.name}: ${changes.join(", ")}`.slice(0, 300),
    });
  }
  refresh(teamId);
  return { ok: true };
}

export async function setItemRemoved(teamId: string, itemId: string, removed: boolean): Promise<ActionResult> {
  const id = uuid.safeParse(itemId);
  if (!id.success) return { ok: false, error: "Invalid item." };
  const { supabase, user } = await requireTeam(teamId);
  const { data, error } = await supabase
    .from("request_items")
    .update({ removed_at: removed ? new Date().toISOString() : null })
    .eq("id", id.data)
    .eq("team_id", teamId)
    .select("name, request_id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not update item." };
  await supabase.from("activity_events").insert({
    team_id: teamId,
    request_id: data.request_id,
    actor_id: user.id,
    kind: removed ? "item_removed" : "item_restored",
    summary: `${removed ? "Removed" : "Restored"} ${data.name}`.slice(0, 300),
  });
  refresh(teamId);
  return { ok: true };
}

export async function markTeamSeen(teamId: string): Promise<void> {
  const { supabase, user } = await requireTeam(teamId);
  await supabase
    .from("team_members")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("team_id", teamId)
    .eq("user_id", user.id);
}
