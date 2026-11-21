import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import { publicEnv, serverEnv } from "@/lib/env";

export function pushConfigured() {
  return Boolean(publicEnv.vapidPublicKey() && serverEnv.vapidPrivateKey());
}

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(serverEnv.vapidSubject(), publicEnv.vapidPublicKey(), serverEnv.vapidPrivateKey());
  configured = true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Notify every manager of a team who opted in. Never throws. */
export async function notifyTeamManagers(teamId: string, payload: PushPayload) {
  if (!pushConfigured()) return { sent: 0 };
  try {
    configure();
    const supabase = createServiceClient();
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("notify_new_requests", true);
    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) return { sent: 0 };

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    const body = JSON.stringify(payload);
    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 24, urgency: "normal" },
          );
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) dead.push(s.id);
          else console.error("push send failed", status ?? err);
        }
      }),
    );
    if (dead.length) await supabase.from("push_subscriptions").delete().in("id", dead);
    return { sent };
  } catch (err) {
    console.error("notifyTeamManagers failed", err);
    return { sent: 0 };
  }
}
