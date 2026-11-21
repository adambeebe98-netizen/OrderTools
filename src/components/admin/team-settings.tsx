"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Download, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Spinner } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { renameTeam, rotateTeamLink } from "@/lib/actions/team";

export function TeamSettings({ teamId, teamName, slug, siteUrl }: { teamId: string; teamName: string; slug: string; siteUrl: string }) {
  const router = useRouter();
  const [origin, setOrigin] = React.useState(siteUrl);
  const [qr, setQr] = React.useState<string | null>(null);
  const [name, setName] = React.useState(teamName);
  const [saving, setSaving] = React.useState(false);
  const [confirmRotate, setConfirmRotate] = React.useState(false);
  const [rotating, setRotating] = React.useState(false);

  React.useEffect(() => {
    // Prefer the configured site URL; fall back to the current origin in development.
    if (!process.env.NEXT_PUBLIC_SITE_URL) setOrigin(window.location.origin);
  }, []);

  const link = `${origin}/r/${slug}`;

  React.useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 512, color: { dark: "#1e293b", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: `${teamName} supply requests`, text: "Request supplies here:", url: link }).catch(() => {});
    } else copy();
  };

  return (
    <>
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="font-semibold">Team request link</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Send this to your technicians (text it once, or have them scan the QR code). They can add it to their home screen like an app.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="grid flex-1 content-start gap-3">
            <Input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Team request link" className="font-mono text-sm" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy}>
                <Copy /> Copy link
              </Button>
              <Button variant="outline" onClick={share}>
                <Share2 /> Share
              </Button>
              <Button variant="outline" onClick={() => setConfirmRotate(true)}>
                <RefreshCw /> New link
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can submit requests and look up history by name, so share it only with your team. If it leaks, create a new link.
            </p>
          </div>
          {qr && (
            <div className="flex flex-col items-center gap-2">
              <img src={qr} alt={`QR code for ${link}`} className="size-36 rounded-lg border" />
              <a href={qr} download={`${slug}-qr.png`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Download className="size-3" /> Download QR
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const res = await renameTeam(teamId, name);
            setSaving(false);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Team name saved");
            router.refresh();
          }}
        >
          <Field label="Team name" htmlFor="team-name" className="flex-1" hint="Shown to technicians at the top of the request page.">
            <Input id="team-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" variant="outline" disabled={saving || !name.trim() || name === teamName} className="sm:mb-5">
            {saving && <Spinner />} Save
          </Button>
        </form>
      </section>

      <Dialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new team link?</DialogTitle>
            <DialogDescription>The current link stops working right away. You&apos;ll need to send the new link to every technician.</DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRotate(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rotating}
              onClick={async () => {
                setRotating(true);
                const res = await rotateTeamLink(teamId);
                setRotating(false);
                if (!res.ok) return void toast.error(res.error);
                toast.success("New link created");
                setConfirmRotate(false);
                router.refresh();
              }}
            >
              {rotating && <Spinner />} Replace link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
