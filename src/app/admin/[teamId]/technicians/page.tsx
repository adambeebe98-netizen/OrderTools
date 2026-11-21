import { requireTeam } from "@/lib/auth";
import { getTechnicianStats } from "@/lib/data/admin";
import { PageHeader } from "@/components/ui/misc";
import { TechniciansManager } from "@/components/admin/technicians-manager";

export const metadata = { title: "Technicians" };
export const dynamic = "force-dynamic";

export default async function TechniciansPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { supabase } = await requireTeam(teamId);
  const technicians = await getTechnicianStats(supabase, teamId);
  return (
    <>
      <PageHeader
        title="Technicians"
        description="Technicians are added automatically the first time they submit a request. Rename or merge duplicates here."
      />
      <TechniciansManager teamId={teamId} technicians={technicians} />
    </>
  );
}
