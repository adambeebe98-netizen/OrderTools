"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin, requireTeam } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { makeTeamSlug } from "@/lib/names";
import { teamNameSchema, technicianNameSchema } from "@/lib/validation";
import { notifyUser } from "@/lib/push-user";
import type { ActionResult } from "@/lib/actions/requests";

const uuid = z.string().uuid();

// ----- Technicians ---------------------------------------------------------

export async function renameTechnician(teamId: string, techId: string, name: string): Promise<ActionResult> {
  const parsed = technicianNameSchema.safeParse(name);
  if (!uuid.safeParse(techId).success || !parsed.success) return { ok: false, error: "Enter a valid name." };
  const { supabase } = await requireTeam(teamId);
  const { error } = await supabase.from("technicians").update({ name: parsed.data }).eq("id", techId).eq("team_id", teamId);
  if (error) {
    return { ok: false, error: error.code === "23505" ? "Another technician already has that name — merge them instead." : "Could not rename." };
  }
  // Keep the snapshot on their requests in sync so lists show the new name.
  await supabase.from("requests").update({ technician_name: parsed.data }).eq("technician_id", techId).eq("team_id", teamId);
  revalidatePath(`/admin/${teamId}`, "layout");
  return { ok: true };
}

export async function mergeTechnicians(teamId: string, fromId: string, intoId: string): Promise<ActionResult> {
  if (!uuid.safeParse(fromId).success || !uuid.safeParse(intoId).success) return { ok: false, error: "Choose a technician." };
  const { supabase } = await requireTeam(teamId);
  const { error } = await supabase.rpc("merge_technicians", { p_team_id: teamId, p_from: fromId, p_into: intoId });
  if (error) return { ok: false, error: "Could not merge technicians." };
  revalidatePath(`/admin/${teamId}`, "layout");
  return { ok: true };
}

export async function setTechnicianArchived(teamId: string, techId: string, archived: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(techId).success) return { ok: false, error: "Invalid technician." };
  const { supabase } = await requireTeam(teamId);
  const { error } = await supabase
    .from("technicians")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", techId)
    .eq("team_id", teamId);
  if (error) return { ok: false, error: "Could not update technician." };
  revalidatePath(`/admin/${teamId}/technicians`);
  return { ok: true };
}

// ----- Team settings -------------------------------------------------------

export async function renameTeam(teamId: string, name: string): Promise<ActionResult> {
  const parsed = teamNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase } = await requireTeam(teamId);
  const { error } = await supabase.from("teams").update({ name: parsed.data }).eq("id", teamId);
  if (error) return { ok: false, error: "Could not rename team." };
  revalidatePath(`/admin/${teamId}`, "layout");
  return { ok: true };
}

/** Issue a new team link. The old link stops working immediately. */
export async function rotateTeamLink(teamId: string): Promise<ActionResult & { slug?: string }> {
  const { supabase, team } = await requireTeam(teamId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = makeTeamSlug(team.name);
    const { error } = await supabase.from("teams").update({ slug }).eq("id", teamId);
    if (!error) {
      revalidatePath(`/admin/${teamId}/settings`);
      return { ok: true, slug };
    }
    if (error.code !== "23505") break;
  }
  return { ok: false, error: "Could not create a new link." };
}

export async function setNotifyPreference(teamId: string, enabled: boolean): Promise<ActionResult> {
  const { supabase, user } = await requireTeam(teamId);
  const { error, count } = await supabase
    .from("team_members")
    .update({ notify_new_requests: enabled }, { count: "exact" })
    .eq("team_id", teamId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not save." };
  if (!count) return { ok: false, error: "You aren't a manager on this team, so you don't receive its notifications." };
  return { ok: true };
}

export async function sendTestNotification(teamId: string): Promise<ActionResult> {
  const { user } = await requireTeam(teamId);
  const res = await notifyUser(user.id, {
    title: "Test notification",
    body: "Push notifications are working on this device.",
    url: `/admin/${teamId}`,
    tag: "test",
  });
  if (res.sent === 0) return { ok: false, error: "No subscribed devices. Turn on notifications on this device first." };
  return { ok: true, message: `Sent to ${res.sent} device${res.sent === 1 ? "" : "s"}.` };
}

// ----- Super admin ---------------------------------------------------------

export async function createTeam(name: string): Promise<ActionResult & { id?: string }> {
  const parsed = teamNameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase, user } = await requireSuperAdmin();
  const { data, error } = await supabase.from("teams").insert({ name: parsed.data, slug: makeTeamSlug(parsed.data) }).select("id").single();
  if (error || !data) return { ok: false, error: "Could not create team." };
  // Creator manages the new team by default.
  await supabase.from("team_members").insert({ team_id: data.id, user_id: user.id });
  revalidatePath("/admin/super");
  return { ok: true, id: data.id };
}

export async function setTeamActive(teamId: string, active: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(teamId).success) return { ok: false, error: "Invalid team." };
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("teams").update({ is_active: active }).eq("id", teamId);
  if (error) return { ok: false, error: "Could not update team." };
  revalidatePath("/admin/super");
  return { ok: true };
}

/**
 * Add a manager to a team by email. Existing accounts are added directly;
 * new people get a Supabase invite email (or, if email isn't configured,
 * an account with the temporary password you provide).
 */
export async function addManager(teamId: string, email: string, tempPassword?: string): Promise<ActionResult> {
  const e = z.string().trim().toLowerCase().email().safeParse(email);
  if (!uuid.safeParse(teamId).success || !e.success) return { ok: false, error: "Enter a valid email." };
  await requireSuperAdmin();
  const service = createServiceClient();

  let { data: profile } = await service.from("profiles").select("id").eq("email", e.data).maybeSingle();
  let message = "Manager added.";
  if (!profile) {
    const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    if (tempPassword) {
      if (tempPassword.length < 10) return { ok: false, error: "Temporary password must be at least 10 characters." };
      const { data, error } = await service.auth.admin.createUser({ email: e.data, password: tempPassword, email_confirm: true });
      if (error || !data.user) return { ok: false, error: error?.message ?? "Could not create account." };
      message = "Account created. Share the temporary password securely; they should change it after signing in.";
    } else {
      const { data, error } = await service.auth.admin.inviteUserByEmail(e.data, {
        redirectTo: `${site}/admin/auth/confirm?next=/admin/account`,
      });
      if (error || !data.user) {
        return { ok: false, error: `Invite failed (${error?.message ?? "unknown"}). Try again with a temporary password.` };
      }
      message = "Invite sent. They'll set a password from the email.";
    }
    ({ data: profile } = await service.from("profiles").select("id").eq("email", e.data).maybeSingle());
    if (!profile) return { ok: false, error: "Account created but profile missing — try again." };
  }

  const { error } = await service.from("team_members").upsert({ team_id: teamId, user_id: profile.id }, { onConflict: "team_id,user_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: "Could not add manager to team." };
  revalidatePath("/admin/super");
  return { ok: true, message };
}

export async function removeManager(teamId: string, userId: string): Promise<ActionResult> {
  if (!uuid.safeParse(teamId).success || !uuid.safeParse(userId).success) return { ok: false, error: "Invalid input." };
  const { supabase } = await requireSuperAdmin();
  const { error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
  if (error) return { ok: false, error: "Could not remove manager." };
  revalidatePath("/admin/super");
  return { ok: true };
}

export async function setSuperAdmin(userId: string, value: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(userId).success) return { ok: false, error: "Invalid user." };
  const { user } = await requireSuperAdmin();
  if (userId === user.id && !value) return { ok: false, error: "You can't remove your own super admin access." };
  const service = createServiceClient();
  const { error } = await service.from("profiles").update({ is_super_admin: value }).eq("id", userId);
  if (error) return { ok: false, error: "Could not update." };
  revalidatePath("/admin/super");
  return { ok: true };
}
