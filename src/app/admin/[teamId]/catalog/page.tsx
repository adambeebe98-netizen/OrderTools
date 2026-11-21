import { requireTeam } from "@/lib/auth";
import { getCatalog, getCustomItemSummary } from "@/lib/data/admin";
import { PageHeader } from "@/components/ui/misc";
import { CatalogManager } from "@/components/admin/catalog-manager";

export const metadata = { title: "Catalog" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { teamId } = await params;
  const { tab } = await searchParams;
  const { supabase } = await requireTeam(teamId);
  const [catalog, custom] = await Promise.all([getCatalog(supabase, teamId), getCustomItemSummary(supabase, teamId)]);
  const validTab = tab === "categories" || tab === "custom" || tab === "import" ? tab : "items";
  return (
    <>
      <PageHeader title="Catalog" description="What technicians can pick from. Changes show up on the request page right away." />
      <CatalogManager
        teamId={teamId}
        categories={catalog.categories}
        items={catalog.items}
        groups={catalog.groups}
        requestedIds={catalog.requestedIds}
        custom={custom}
        initialTab={validTab}
      />
    </>
  );
}
