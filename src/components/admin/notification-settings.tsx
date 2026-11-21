"use client";

import * as React from "react";
import { BellOff, BellRing, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/misc";
import { sendTestNotification, setNotifyPreference } from "@/lib/actions/team";

type Support = "checking" | "unsupported" | "needs-install" | "supported";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotificationSettings({
  teamId,
  vapidPublicKey,
  isMember,
  notifyEnabled,
}: {
  teamId: string;
  vapidPublicKey: string;
  isMember: boolean;
  notifyEnabled: boolean;
}) {
  const [support, setSupport] = React.useState<Support>("checking");
  const [permission, setPermission] = React.useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pref, setPref] = React.useState(notifyEnabled);

  React.useEffect(() => {
    const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!hasApis) {
      setSupport(isIOS && !standalone ? "needs-install" : "unsupported");
      return;
    }
    setSupport("supported");
    setPermission(Notification.permission);
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error("Notifications are blocked. Allow them in your browser's site settings.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save failed");
      setSubscribed(true);
      if (isMember && !pref) {
        await setNotifyPreference(teamId, true);
        setPref(true);
      }
      toast.success("Notifications are on for this device");
    } catch {
      toast.error("Couldn't turn on notifications on this device.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notifications are off for this device");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 className="font-semibold">Notifications</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Get a push notification when a technician submits a request. New requests always show on the dashboard and the bell icon, even with
        notifications off.
      </p>

      <div className="grid gap-4">
        <div className="flex items-start gap-3 rounded-lg border p-3">
          <span className="mt-0.5 rounded-md bg-muted p-2 text-muted-foreground">{subscribed ? <BellRing className="size-4" /> : <BellOff className="size-4" />}</span>
          <div className="flex-1 text-sm">
            <p className="font-medium">This device</p>
            {!vapidPublicKey ? (
              <p className="text-muted-foreground">Push isn&apos;t configured on the server (VAPID keys missing).</p>
            ) : support === "checking" ? (
              <p className="text-muted-foreground">Checking…</p>
            ) : support === "needs-install" ? (
              <p className="text-muted-foreground">
                On iPhone/iPad, tap Share → <span className="font-medium">Add to Home Screen</span>, open the app from there, then turn notifications on.
              </p>
            ) : support === "unsupported" ? (
              <p className="text-muted-foreground">This browser doesn&apos;t support push notifications.</p>
            ) : permission === "denied" ? (
              <p className="text-muted-foreground">Notifications are blocked for this site. Allow them in your browser settings, then reload.</p>
            ) : (
              <p className="text-muted-foreground">{subscribed ? "Push notifications are on for this browser." : "Push notifications are off for this browser."}</p>
            )}
          </div>
          {vapidPublicKey && support === "supported" && permission !== "denied" && (
            <Button variant={subscribed ? "outline" : "default"} size="sm" onClick={subscribed ? disable : enable} disabled={busy}>
              {busy && <Spinner />} {subscribed ? "Turn off" : "Turn on"}
            </Button>
          )}
        </div>

        {isMember ? (
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span>
              <span className="block font-medium">New request alerts for this team</span>
              <span className="text-muted-foreground">Applies to all of your subscribed devices.</span>
            </span>
            <Switch
              checked={pref}
              onCheckedChange={async (v) => {
                setPref(v);
                const res = await setNotifyPreference(teamId, v);
                if (!res.ok) {
                  setPref(!v);
                  toast.error(res.error);
                }
              }}
            />
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">You&apos;re viewing this team as a super admin and aren&apos;t one of its managers, so you won&apos;t get its alerts.</p>
        )}

        {subscribed && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await sendTestNotification(teamId);
                if (res.ok) toast.success(res.message ?? "Sent");
                else toast.error(res.error);
              }}
            >
              <Send /> Send test notification
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
