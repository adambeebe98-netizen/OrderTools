import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireTeam } from "@/lib/auth";
import { getRequest } from "@/lib/data/admin";
import { RequestDetail } from "@/components/admin/request-detail";

export const metadata = { title: "Request" };
export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ teamId: string; requestId: string }> }) {
  const { teamId, requestId } = await params;
  const { supabase } = await requireTeam(teamId);
  const request = await getRequest(supabase, teamId, requestId);
  if (!request) notFound();
  return (
    <>
      <Link href={`/admin/${teamId}/requests`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Requests
      </Link>
      <RequestDetail teamId={teamId} request={request} />
    </>
  );
}
