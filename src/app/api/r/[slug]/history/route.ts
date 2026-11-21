import { NextResponse, type NextRequest } from "next/server";
import { historyLookupSchema } from "@/lib/validation";
import { HISTORY_DAYS, getPublicTeam, type PublicHistoryRequest } from "@/lib/data/public";
import { createServiceClient } from "@/lib/supabase/service";
import { LIMITS, checkRateLimits, clientFingerprint } from "@/lib/rate-limit";
import { nameKey } from "@/lib/names";

export const dynamic = "force-dynamic";

/**
 * Technician request history, looked up by team link + name.
 * A name is NOT authentication, so only low-sensitivity fields are returned.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const parsed = historyLookupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your name." }, { status: 400 });

  const team = await getPublicTeam(slug);
  if (!team) return NextResponse.json({ error: "This request link is no longer active." }, { status: 404 });

  const fp = await clientFingerprint();
  if (!(await checkRateLimits([LIMITS.historyPerClient(fp)]))) {
    return NextResponse.json({ error: "Too many lookups. Please wait a few minutes." }, { status: 429 });
  }

  const supabase = createServiceClient();
  const { data: tech } = await supabase
    .from("technicians")
    .select("id")
    .eq("team_id", team.id)
    .eq("name_key", nameKey(parsed.data.name))
    .maybeSingle();
  if (!tech) return NextResponse.json({ requests: [] });

  const since = new Date(Date.now() - HISTORY_DAYS * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("requests")
    .select(
      "id, created_at, status, ordered_at, note, request_items(id, name, unit, quantity, status, ordered_at, is_custom, removed_at)",
    )
    .eq("team_id", team.id)
    .eq("technician_id", tech.id)
    .is("removed_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("history lookup failed", error);
    return NextResponse.json({ error: "Could not load your requests." }, { status: 500 });
  }

  const requests: PublicHistoryRequest[] = (data ?? []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    status: r.status as PublicHistoryRequest["status"],
    ordered_at: r.ordered_at,
    note: r.note,
    items: r.request_items
      .filter((i) => !i.removed_at)
      .map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        status: i.status as "requested" | "ordered",
        ordered_at: i.ordered_at,
        is_custom: i.is_custom,
      })),
  }));

  return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store" } });
}
