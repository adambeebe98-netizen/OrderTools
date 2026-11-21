"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, PackageCheck, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MarkOrderedDialog } from "@/components/admin/mark-ordered-dialog";
import { markItemsOrdered, markItemsRequested, setItemRemoved, updateRequestItem } from "@/lib/actions/requests";
import { cn, formatDateTime, plural, safeHttpUrl } from "@/lib/utils";

type Item = {
  id: string;
  name: string;
  unit: string | null;
  quantity: number;
  status: string;
  ordered_at: string | null;
  is_custom: boolean;
  grainger_sku: string | null;
  grainger_url: string | null;
  custom_note: string | null;
  custom_url: string | null;
  removed_at: string | null;
  order_batches: { reference: string | null } | null;
};

type Request = {
  id: string;
  technician_id: string;
  technician_name: string;
  note: string | null;
  status: string;
  ordered_at: string | null;
  created_at: string;
  removed_at: string | null;
  request_items: Item[];
};

export function RequestDetail({ teamId, request }: { teamId: string; request: Request }) {
  const router = useRouter();
  const active = request.request_items.filter((i) => !i.removed_at);
  const removed = request.request_items.filter((i) => i.removed_at);
  const outstanding = active.filter((i) => i.status === "requested");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(outstanding.map((i) => i.id)));
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setSelected(new Set(request.request_items.filter((i) => !i.removed_at && i.status === "requested").map((i) => i.id)));
  }, [request]);

  const run = async (p: Promise<{ ok: boolean; error?: string }>, success?: string) => {
    const res = await p;
    if (!res.ok) toast.error(res.error ?? "Something went wrong");
    else {
      if (success) toast.success(success);
      router.refresh();
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{request.technician_name}</h1>
            <StatusBadge status={request.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Requested {formatDateTime(request.created_at)}
            {request.status === "ordered" && request.ordered_at && ` · ordered ${formatDateTime(request.ordered_at)}`}
            {" · "}
            <Link href={`/admin/${teamId}/requests?technician=${request.technician_id}&status=all`} className="text-primary hover:underline">
              All requests from {request.technician_name.split(" ")[0]}
            </Link>
          </p>
        </div>
        {outstanding.length > 0 && (
          <Button variant="success" onClick={() => setDialogOpen(true)} disabled={selected.size === 0}>
            <PackageCheck /> Mark {selected.size === outstanding.length ? "all" : selected.size} ordered
          </Button>
        )}
      </div>

      {request.note && (
        <Card className="border-warning/30 bg-warning-soft/50">
          <CardContent className="p-4 text-sm sm:p-4">
            <span className="font-medium">Note from technician:</span> {request.note}
          </CardContent>
        </Card>
      )}

      {request.removed_at && (
        <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          Every item on this request was removed, so it&apos;s hidden from lists. Restore an item below to bring it back.
        </p>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <ul className="divide-y">
          {active.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onSelect={(v) =>
                setSelected((s) => {
                  const next = new Set(s);
                  if (v) next.add(item.id);
                  else next.delete(item.id);
                  return next;
                })
              }
              onQuantity={(q) => run(updateRequestItem(teamId, item.id, { quantity: q }), "Quantity updated")}
              onRename={(name) => run(updateRequestItem(teamId, item.id, { name }), "Item renamed")}
              onRemove={() => run(setItemRemoved(teamId, item.id, true), `Removed ${item.name}`)}
              onUnorder={() => run(markItemsRequested(teamId, [item.id]), "Moved back to requested")}
            />
          ))}
        </ul>
        {active.length === 0 && <p className="p-4 text-sm text-muted-foreground">No active items.</p>}
      </div>

      {removed.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Removed items</h2>
          <ul className="divide-y rounded-xl border bg-card/60">
            {removed.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                <span className="flex-1 line-through">
                  {item.name} × {item.quantity}
                </span>
                <Button variant="ghost" size="sm" onClick={() => run(setItemRemoved(teamId, item.id, false), "Item restored")}>
                  <RotateCcw /> Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MarkOrderedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        summary={`${plural(selected.size, "item")} from ${request.technician_name}'s request will be marked ordered.${
          selected.size < outstanding.length ? " The rest stay requested." : ""
        }`}
        onConfirm={async (reference) => {
          const res = await markItemsOrdered(teamId, [...selected], reference);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Marked ${plural(res.count ?? 0, "item")} ordered`);
          setDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function ItemRow({
  item,
  selected,
  onSelect,
  onQuantity,
  onRename,
  onRemove,
  onUnorder,
}: {
  item: Item;
  selected: boolean;
  onSelect: (v: boolean) => void;
  onQuantity: (q: number) => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onUnorder: () => Promise<void>;
}) {
  const [qty, setQty] = React.useState(String(item.quantity));
  const [name, setName] = React.useState(item.name);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setQty(String(item.quantity)), [item.quantity]);
  React.useEffect(() => setName(item.name), [item.name]);

  const ordered = item.status === "ordered";
  const link = safeHttpUrl(item.grainger_url) ?? safeHttpUrl(item.custom_url);

  const commitQty = async () => {
    const n = parseInt(qty, 10);
    if (!Number.isFinite(n) || n < 1 || n > 999) {
      toast.error("Quantity must be between 1 and 999");
      setQty(String(item.quantity));
      return;
    }
    if (n === item.quantity) return;
    setBusy(true);
    await onQuantity(n);
    setBusy(false);
  };

  const wrap = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <li className={cn("flex items-start gap-3 px-3 py-3", busy && "opacity-60")}>
      {ordered ? (
        <span className="mt-0.5 size-5" aria-hidden />
      ) : (
        <Checkbox className="mt-0.5" checked={selected} onCheckedChange={(v) => onSelect(v === true)} aria-label={`Select ${item.name}`} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {item.is_custom && !ordered ? (
            <input
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium hover:border-input focus:border-ring focus:outline-none"
              value={name}
              maxLength={120}
              aria-label="Item name"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name.trim() !== item.name && wrap(() => onRename(name.trim()))()}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <span className="font-medium">{item.name}</span>
          )}
          {item.is_custom && <Badge variant="custom">Other item</Badge>}
          <StatusBadge status={item.status} />
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {item.grainger_sku && <span>SKU {item.grainger_sku}</span>}
          {item.unit && item.unit !== "each" && <span>per {item.unit}</span>}
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Product link <ExternalLink className="size-3" />
            </a>
          )}
          {ordered && item.ordered_at && (
            <span>
              Ordered {formatDateTime(item.ordered_at)}
              {item.order_batches?.reference && ` · order ${item.order_batches.reference}`}
            </span>
          )}
        </div>
        {item.custom_note && <p className="mt-1 text-sm text-muted-foreground">“{item.custom_note}”</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {ordered ? (
          <>
            <span className="w-14 text-right text-sm font-semibold tabular-nums">× {item.quantity}</span>
            <Button variant="ghost" size="icon-sm" onClick={wrap(onUnorder)} aria-label={`Undo ordered for ${item.name}`} title="Move back to requested">
              <Undo2 className="text-muted-foreground" />
            </Button>
          </>
        ) : (
          <>
            <Input
              className="h-9 w-16 text-center tabular-nums"
              inputMode="numeric"
              value={qty}
              aria-label={`Quantity for ${item.name}`}
              onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 3))}
              onBlur={commitQty}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={wrap(onRemove)}
              aria-label={`Remove ${item.name}`}
              title="Remove (accidental or duplicate)"
            >
              <Trash2 className="text-muted-foreground" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
