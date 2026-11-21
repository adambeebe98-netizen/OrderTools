import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Polled by the admin shell: requests created since this manager last looked. */
export async function GET(_req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("last_seen_at")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .maybeSingle();
  const since = member?.last_seen_at ?? new Date(Date.now() - 86400_000).toISOString();

  const [fresh, outstanding] = await Promise.all([
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .is("removed_at", null)
      .gt("created_at", since),
    supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "requested")
      .is("removed_at", null),
  ]);
  if (fresh.error) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(
    { newCount: fresh.count ?? 0, outstanding: outstanding.count ?? 0 },
    { headers: { "Cache-Control": "no-store" } },
  );
}
