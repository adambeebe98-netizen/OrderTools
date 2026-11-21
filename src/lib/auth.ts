import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null } as const;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_super_admin")
    .eq("id", user.id)
    .single();
  return { supabase, user, profile } as const;
});

export async function requireUser() {
  const session = await getSession();
  if (!session.user || !session.profile) redirect("/admin/login");
  return { ...session, user: session.user, profile: session.profile };
}

export async function requireSuperAdmin() {
  const session = await requireUser();
  if (!session.profile.is_super_admin) notFound();
  return session;
}

/** Load a team the signed-in user may manage. RLS returns no row for other teams → 404. */
export const requireTeam = cache(async (teamId: string) => {
  const session = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) notFound();
  const { data: team } = await session.supabase
    .from("teams")
    .select("id, name, slug, is_active")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) notFound();
  return { ...session, team };
});

export async function listMyTeams() {
  const { supabase, user, profile } = await requireUser();
  if (profile.is_super_admin) {
    const { data } = await supabase.from("teams").select("id, name, slug").order("name");
    return data ?? [];
  }
  const { data } = await supabase
    .from("team_members")
    .select("teams(id, name, slug)")
    .eq("user_id", user.id);
  return (data ?? [])
    .map((r) => r.teams)
    .filter((t): t is { id: string; name: string; slug: string } => !!t)
    .sort((a, b) => a.name.localeCompare(b.name));
}
