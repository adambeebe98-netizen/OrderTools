import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { pushSubscriptionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Save this browser's push subscription for the signed-in manager. */
export async function POST(request: NextRequest) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });

  // An endpoint belongs to one browser; drop any older row for it, then insert as this user.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) {
    // Endpoint registered to a different account on this browser (RLS hides it from us).
    console.error("push subscribe failed", error.message);
    return NextResponse.json({ error: "Could not save subscription" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const endpoint = z.string().url().safeParse((await request.json().catch(() => ({})))?.endpoint);
  if (!endpoint.success) return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint.data).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
