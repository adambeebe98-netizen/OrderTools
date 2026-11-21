import { requireTeam } from "@/lib/auth";
import { publicEnv } from "@/lib/env";
import { pushConfigured } from "@/lib/push";
import { PageHeader } from "@/components/ui/misc";
import { TeamSettings } from "@/components/admin/team-settings";
import { NotificationSettings } from "@/components/admin/notification-settings";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { supabase, user, team } = await requireTeam(teamId);
  const [{ data: membership }, { data: managers }] = await Promise.all([
    supabase.from("team_members").select("notify_new_requests").eq("team_id", teamId).eq("user_id", user.id).maybeSingle(),
    supabase.from("team_members").select("user_id, profiles(email, full_name)").eq("team_id", teamId),
  ]);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-3xl gap-4">
        <TeamSettings teamId={teamId} teamName={team.name} slug={team.slug} siteUrl={publicEnv.siteUrl()} />
        <NotificationSettings
          teamId={teamId}
          vapidPublicKey={pushConfigured() ? publicEnv.vapidPublicKey() : ""}
          isMember={!!membership}
          notifyEnabled={membership?.notify_new_requests ?? false}
        />
        <section className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="font-semibold">Managers</h2>
          <p className="mb-3 text-sm text-muted-foreground">People who can see and order this team&apos;s requests. A super admin can add or remove managers.</p>
          <ul className="divide-y rounded-lg border text-sm">
            {(managers ?? []).map((m) => (
              <li key={m.user_id} className="flex items-center justify-between px-3 py-2">
                <span>{m.profiles?.full_name || m.profiles?.email}</span>
                {m.profiles?.full_name && <span className="text-muted-foreground">{m.profiles.email}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
