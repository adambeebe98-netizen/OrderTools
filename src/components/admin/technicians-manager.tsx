"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, GitMerge, Pencil, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState, Spinner } from "@/components/ui/misc";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mergeTechnicians, renameTechnician, setTechnicianArchived } from "@/lib/actions/team";
import { cn, plural, timeAgo } from "@/lib/utils";

type Tech = { id: string; name: string; archived_at: string | null; last_request_at: string | null; total: number; open: number };

export function TechniciansManager({ teamId, technicians }: { teamId: string; technicians: Tech[] }) {
  const router = useRouter();
  const [showArchived, setShowArchived] = React.useState(false);
  const [rename, setRename] = React.useState<Tech | null>(null);
  const [merge, setMerge] = React.useState<Tech | null>(null);
  const visible = technicians.filter((t) => showArchived || !t.archived_at);

  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived
      </label>
      {visible.length === 0 ? (
        <EmptyState icon={<Users />} title="No technicians yet" description="Share your team link from Settings. Technicians appear here after their first request." />
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((t) => (
            <li key={t.id} className={cn("flex items-center gap-3 px-3 py-2.5", t.archived_at && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/${teamId}/requests?technician=${t.id}&status=all`} className="font-medium hover:underline">
                  {t.name}
                </Link>
                {t.archived_at && <Badge variant="outline" className="ml-2">Archived</Badge>}
                <p className="text-xs text-muted-foreground">
                  {plural(t.total, "request")}
                  {t.open > 0 && ` · ${t.open} outstanding`}
                  {t.last_request_at && ` · last ${timeAgo(t.last_request_at)}`}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Rename ${t.name}`} onClick={() => setRename(t)}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Merge ${t.name} into another technician`} title="Merge duplicate" onClick={() => setMerge(t)}>
                <GitMerge />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.archived_at ? `Restore ${t.name}` : `Archive ${t.name}`}
                title={t.archived_at ? "Restore" : "Archive (hide from filters; they come back automatically if they submit again)"}
                onClick={async () => {
                  const res = await setTechnicianArchived(teamId, t.id, !t.archived_at);
                  if (!res.ok) return void toast.error(res.error);
                  router.refresh();
                }}
              >
                {t.archived_at ? <ArchiveRestore /> : <Archive />}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <RenameDialog teamId={teamId} tech={rename} onClose={() => setRename(null)} />
      <MergeDialog teamId={teamId} tech={merge} technicians={technicians} onClose={() => setMerge(null)} />
    </div>
  );
}

function RenameDialog({ teamId, tech, onClose }: { teamId: string; tech: Tech | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => setName(tech?.name ?? ""), [tech]);
  return (
    <Dialog open={!!tech} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!tech) return;
            setPending(true);
            const res = await renameTechnician(teamId, tech.id, name);
            setPending(false);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Technician renamed");
            onClose();
            router.refresh();
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename technician</DialogTitle>
            <DialogDescription>
              The technician must use the new name on their phone to see their history. They can change it from the request page.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="pb-4">
            <Field label="Name" htmlFor="tech-rename">
              <Input id="tech-rename" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Spinner />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({ teamId, tech, technicians, onClose }: { teamId: string; tech: Tech | null; technicians: Tech[]; onClose: () => void }) {
  const router = useRouter();
  const [into, setInto] = React.useState("");
  const [pending, setPending] = React.useState(false);
  React.useEffect(() => setInto(""), [tech]);
  const target = technicians.find((t) => t.id === into);
  return (
    <Dialog open={!!tech} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge {tech?.name}</DialogTitle>
          <DialogDescription>Moves all of {tech?.name}&apos;s requests to another technician and removes the duplicate.</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-4">
          <Field label="Merge into" htmlFor="merge-into">
            <NativeSelect id="merge-into" value={into} onChange={(e) => setInto(e.target.value)}>
              <option value="">Choose a technician…</option>
              {technicians
                .filter((t) => t.id !== tech?.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          {target && tech && (
            <p className="mt-3 text-sm text-muted-foreground">
              {plural(tech.total, "request")} will move to <span className="font-medium text-foreground">{target.name}</span>. This can&apos;t be undone.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!into || pending}
            onClick={async () => {
              if (!tech) return;
              setPending(true);
              const res = await mergeTechnicians(teamId, tech.id, into);
              setPending(false);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Technicians merged");
              onClose();
              router.refresh();
            }}
          >
            {pending && <Spinner />} Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
