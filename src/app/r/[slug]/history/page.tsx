import { notFound } from "next/navigation";
import { getPublicTeam } from "@/lib/data/public";
import { TechnicianHistory } from "@/components/tech/technician-history";

export const metadata = { title: "My requests" };

export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getPublicTeam(slug);
  if (!team) notFound();
  return <TechnicianHistory slug={team.slug} teamName={team.name} />;
}
