import { NextResponse, after, type NextRequest } from "next/server";
import { submitRequestSchema } from "@/lib/validation";
import { getPublicTeam } from "@/lib/data/public";
import { createServiceClient } from "@/lib/supabase/service";
import { LIMITS, checkRateLimits, clientFingerprint } from "@/lib/rate-limit";
import { notifyTeamManagers } from "@/lib/push";
import { plural } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = submitRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check your request." },
      { status: 400 },
    );
  }

  const team = await getPublicTeam(slug);
  if (!team) {
    return NextResponse.json({ error: "This request link is no longer active. Ask your manager for the new link." }, { status: 404 });
  }

  // Honeypot: pretend success so bots don't learn anything.
  if (parsed.data.website) {
    return NextResponse.json({ id: crypto.randomUUID() }, { status: 201 });
  }

  const fp = await clientFingerprint();
  const allowed = await checkRateLimits([LIMITS.submitPerClient(team.id, fp), LIMITS.submitPerTeam(team.id)]);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests from this device. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const supabase = createServiceClient();
  const { data: requestId, error } = await supabase.rpc("submit_request", {
    p_slug: slug,
    p_technician_name: parsed.data.name,
    p_items: parsed.data.items,
    p_note: parsed.data.note ?? undefined,
  });

  if (error || !requestId) {
    const known: Record<string, string> = {
      catalog_item_not_found: "One of the items is no longer available. Please refresh and try again.",
      team_not_found: "This request link is no longer active.",
    };
    const message = Object.entries(known).find(([k]) => error?.message.includes(k))?.[1];
    if (!message) console.error("submit_request failed", error);
    return NextResponse.json({ error: message ?? "Could not submit your request. Please try again." }, { status: message ? 400 : 500 });
  }

  const itemCount = parsed.data.items.length;
  after(() =>
    notifyTeamManagers(team.id, {
      title: `New supply request from ${parsed.data.name}`,
      body: `${plural(itemCount, "item")} requested`,
      url: `/admin/${team.id}/requests/${requestId}`,
      tag: `request-${requestId}`,
    }),
  );

  return NextResponse.json({ id: requestId }, { status: 201 });
}
