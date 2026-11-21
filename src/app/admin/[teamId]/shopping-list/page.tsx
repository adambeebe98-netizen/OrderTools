import { requireTeam } from "@/lib/auth";
import { getOutstandingItems } from "@/lib/data/admin";
import { ShoppingList } from "@/components/admin/shopping-list";

export const metadata = { title: "Shopping list" };
export const dynamic = "force-dynamic";

export default async function ShoppingListPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { teamId } = await params;
  const { view } = await searchParams;
  const { supabase, team } = await requireTeam(teamId);
  const items = await getOutstandingItems(supabase, teamId);
  return <ShoppingList teamId={teamId} teamName={team.name} items={items} initialView={view === "technician" ? "technician" : "product"} />;
}
