import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SuperAdmin } from "./super-admin";

export const metadata = { title: "Teams & admins" };
export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const { user } = await requireSuperAdmin();
  // Super admins may see everything; the service client is safe here behind requireSuperAdmin.
  const service = createServiceClient();
  const [{ data: teams }, { data: members }, { data: profiles }, { data: open }] = await Promise.all([
    service.from("teams").select("id, name, slug, is_active, created_at").order("name"),
    service.from("team_members").select("team_id, user_id"),
    service.from("profiles").select("id, email, full_name, is_super_admin").order("email"),
    service.from("requests").select("team_id").eq("status", "requested").is("removed_at", null),
  ]);
  const openByTeam = new Map<string, number>();
  for (const r of open ?? []) openByTeam.set(r.team_id, (openByTeam.get(r.team_id) ?? 0) + 1);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Dashboard
      </Link>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Teams &amp; admins</h1>
      <p className="mb-6 text-sm text-muted-foreground">Create teams, assign managers, and manage super admin access.</p>
      <SuperAdmin
        currentUserId={user.id}
        teams={(teams ?? []).map((t) => ({
          ...t,
          openRequests: openByTeam.get(t.id) ?? 0,
          managers: (members ?? []).filter((m) => m.team_id === t.id).map((m) => m.user_id),
        }))}
        profiles={profiles ?? []}
      />
    </main>
  );
}
