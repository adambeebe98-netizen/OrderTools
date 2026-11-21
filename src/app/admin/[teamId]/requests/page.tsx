import { after } from "next/server";
import { requireTeam } from "@/lib/auth";
import { PAGE_SIZE, getLastSeen, getRequests, getTechnicianOptions, type RequestFilters } from "@/lib/data/admin";
import { PageHeader } from "@/components/ui/misc";
import { RequestsView } from "@/components/admin/requests-view";

export const metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RequestsPage({ params, searchParams }: { params: Promise<{ teamId: string }>; searchParams: Promise<SP> }) {
  const { teamId } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requireTeam(teamId);

  const statusParam = one(sp.status);
  const filters: RequestFilters = {
    status: statusParam === "ordered" || statusParam === "all" ? statusParam : "requested",
    technician: one(sp.technician)?.match(/^[0-9a-f-]{36}$/i) ? one(sp.technician) : undefined,
    q: one(sp.q)?.slice(0, 80) || undefined,
    sort: one(sp.sort) === "oldest" ? "oldest" : "newest",
    page: Math.max(1, parseInt(one(sp.page) ?? "1", 10) || 1),
  };

  const [{ requests, total }, technicians, { lastSeen, isMember }] = await Promise.all([
    getRequests(supabase, teamId, filters),
    getTechnicianOptions(supabase, teamId),
    getLastSeen(supabase, teamId, user.id),
  ]);

  if (isMember) {
    after(async () => {
      await supabase.from("team_members").update({ last_seen_at: new Date().toISOString() }).eq("team_id", teamId).eq("user_id", user.id);
    });
  }

  return (
    <>
      <PageHeader title="Requests" description="Every supply request from your technicians." />
      <RequestsView
        teamId={teamId}
        requests={requests}
        total={total}
        pageSize={PAGE_SIZE}
        filters={filters}
        technicians={technicians.map((t) => ({ id: t.id, name: t.name }))}
        lastSeen={lastSeen}
      />
    </>
  );
}
