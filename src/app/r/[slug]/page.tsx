import { notFound } from "next/navigation";
import { getPublicCatalog, getPublicTeam } from "@/lib/data/public";
import { TechnicianApp } from "@/components/tech/technician-app";

export const dynamic = "force-dynamic";

export default async function TeamRequestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getPublicTeam(slug);
  if (!team) notFound();
  const catalog = await getPublicCatalog(team.id);
  return <TechnicianApp slug={team.slug} teamName={team.name} categories={catalog.categories} items={catalog.items} />;
}
