"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ClipboardCopy, Download, ExternalLink, Filter, PackageCheck, ShoppingCart } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkOrderedDialog } from "@/components/admin/mark-ordered-dialog";
import { markItemsOrdered } from "@/lib/actions/requests";
import {
  consolidateByProduct,
  graingerQuickOrder,
  groupByTechnician,
  productListToCsv,
  productListToText,
  technicianListToCsv,
  technicianListToText,
  type OutstandingItem,
} from "@/lib/consolidate";
import { cn, formatDate, plural, safeHttpUrl, timeAgo } from "@/lib/utils";

type View = "product" | "technician";

function checkState(ids: string[], selected: Set<string>): boolean | "indeterminate" {
  const n = ids.filter((id) => selected.has(id)).length;
  return n === 0 ? false : n === ids.length ? true : "indeterminate";
}

export function ShoppingList({
  teamId,
  teamName,
  items,
  initialView,
}: {
  teamId: string;
  teamName: string;
  items: OutstandingItem[];
  initialView: View;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<View>(initialView);
  // Requests included in this ordering batch (default: all outstanding).
  const requests = React.useMemo(() => {
    const map = new Map<string, { id: string; technician: string; created_at: string; count: number }>();
    for (const i of items) {
      const r = map.get(i.request_id) ?? { id: i.request_id, technician: i.technician_name, created_at: i.request_created_at, count: 0 };
      r.count += 1;
      map.set(i.request_id, r);
    }
    return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [items]);

  const [excludedRequests, setExcludedRequests] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  const [requestsOpen, setRequestsOpen] = React.useState(false);
  const [orderOpen, setOrderOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // When server data changes (after marking ordered / new requests), select everything new.
  const itemKey = items.map((i) => i.id).join(",");
  React.useEffect(() => {
    setSelected(new Set(items.map((i) => i.id)));
    setExcludedRequests((prev) => new Set([...prev].filter((id) => items.some((i) => i.request_id === id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const included = React.useMemo(() => items.filter((i) => !excludedRequests.has(i.request_id)), [items, excludedRequests]);
  const chosen = React.useMemo(() => included.filter((i) => selected.has(i.id)), [included, selected]);

  const productLines = React.useMemo(() => consolidateByProduct(included), [included]);
  const techGroups = React.useMemo(() => groupByTechnician(included), [included]);
  const chosenProducts = React.useMemo(() => consolidateByProduct(chosen), [chosen]);
  const chosenGroups = React.useMemo(() => groupByTechnician(chosen), [chosen]);

  const setIds = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const toggleExpanded = (key: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allIds = included.map((i) => i.id);
  const chosenTechCount = new Set(chosen.map((i) => i.technician_id)).size;
  const chosenRequestCount = new Set(chosen.map((i) => i.request_id)).size;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  };
  const download = (csv: string, name: string) => {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const stamp = new Date().toISOString().slice(0, 10);

  if (items.length === 0) {
    return (
      <>
        <PageHeader title="Shopping list" description="Everything your technicians are waiting on, combined." />
        <EmptyState icon={<ShoppingCart />} title="Nothing to order" description="When technicians submit requests, their items are combined here." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Shopping list"
        description={`${plural(productLines.length, "product")} · ${plural(techGroups.length, "technician")} · ${plural(
          requests.length - excludedRequests.size,
          "request",
        )} included`}
        actions={
          <>
            <Button variant="outline" onClick={() => setRequestsOpen(true)}>
              <Filter /> Requests ({requests.length - excludedRequests.size}/{requests.length})
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="outline" disabled={chosen.length === 0}>
                  <ClipboardCopy /> Copy / export <ChevronDown />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-64 rounded-xl border bg-card p-1 shadow-lg">
                  {[
                    { label: "Copy list by product", run: () => copy(productListToText(chosenProducts), "Product list") },
                    { label: "Copy list by technician", run: () => copy(technicianListToText(chosenGroups), "Technician list") },
                    {
                      label: "Copy Grainger quick order (SKU, qty)",
                      run: () => {
                        const { text, missing } = graingerQuickOrder(chosenProducts);
                        if (!text) return void toast.error("None of the selected items have a Grainger SKU.");
                        copy(text, "Quick order");
                        if (missing.length) toast.info(`${plural(missing.length, "item")} without a SKU were left out — order those separately.`);
                      },
                    },
                    { label: "Download CSV by product", run: () => download(productListToCsv(chosenProducts), `shopping-list-${stamp}.csv`) },
                    { label: "Download CSV by technician", run: () => download(technicianListToCsv(chosenGroups), `shopping-list-by-technician-${stamp}.csv`) },
                  ].map((a) => (
                    <DropdownMenu.Item
                      key={a.label}
                      onSelect={a.run}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                    >
                      {a.label.startsWith("Download") ? <Download className="size-4" /> : <ClipboardCopy className="size-4" />}
                      {a.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="Group by">
          {(
            [
              ["product", "By product"],
              ["technician", "By technician"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "h-8 rounded-md px-3 text-sm font-medium",
                view === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={checkState(allIds, selected)} onCheckedChange={(v) => setIds(allIds, v === true)} />
          Select all
        </label>
        <span className="text-sm text-muted-foreground">Uncheck anything you aren&apos;t ordering right now — it stays requested.</span>
      </div>

      {included.length === 0 ? (
        <EmptyState title="No requests included" description="Use the Requests button to choose which requests go in this order." />
      ) : view === "product" ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[auto_1fr_120px_90px_110px] items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span className="w-5" />
            <span>Product</span>
            <span>Grainger SKU</span>
            <span className="text-right">Total</span>
            <span className="text-right">Technicians</span>
          </div>
          <ul className="divide-y">
            {productLines.map((line) => {
              const state = checkState(line.itemIds, selected);
              const selectedQty = included.filter((i) => line.itemIds.includes(i.id) && selected.has(i.id)).reduce((n, i) => n + i.quantity, 0);
              const link = safeHttpUrl(line.grainger_url) ?? safeHttpUrl(line.links[0]);
              const isOpen = expanded.has(line.key);
              return (
                <li key={line.key} className={cn(state === false && "bg-muted/30 text-muted-foreground")}>
                  <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-3 py-3 md:grid-cols-[auto_1fr_120px_90px_110px] md:items-center">
                    <Checkbox
                      className="mt-0.5 md:mt-0"
                      checked={state}
                      onCheckedChange={(v) => setIds(line.itemIds, v === true)}
                      aria-label={`Include ${line.name}`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{line.name}</span>
                        {line.is_custom && <Badge variant="custom">Other item</Badge>}
                        {link && (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                            {line.grainger_url ? "Grainger" : "Link"} <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground md:hidden">
                        {line.grainger_sku ? `SKU ${line.grainger_sku}` : "No SKU"}
                        {line.unit && line.unit !== "each" && ` · per ${line.unit}`}
                      </div>
                      {line.notes.length > 0 && <p className="mt-1 text-xs italic text-muted-foreground">“{line.notes.join("” · “")}”</p>}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(line.key)}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground md:hidden"
                        aria-expanded={isOpen}
                      >
                        {plural(line.technicianCount, "technician")} <ChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
                      </button>
                    </div>
                    <span className="hidden font-mono text-sm md:block">{line.grainger_sku ?? <span className="text-muted-foreground">—</span>}</span>
                    <span className="text-right">
                      <span className="text-lg font-semibold tabular-nums text-foreground">
                        {state === "indeterminate" ? `${selectedQty}/${line.totalQuantity}` : line.totalQuantity}
                      </span>
                      {line.unit && line.unit !== "each" && <span className="hidden text-xs text-muted-foreground md:block">{line.unit}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(line.key)}
                      className="hidden items-center justify-end gap-1 text-sm text-muted-foreground hover:text-foreground md:flex"
                      aria-expanded={isOpen}
                    >
                      {line.technicianCount} <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                    </button>
                  </div>
                  {/* Per-technician breakdown is always visible on desktop when expanded; inline summary otherwise */}
                  {isOpen ? (
                    <ul className="mx-3 mb-3 divide-y rounded-lg border bg-background/60 md:ml-11">
                      {line.technicians.map((t) => (
                        <li key={t.technician_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <Checkbox
                            checked={checkState(t.itemIds, selected)}
                            onCheckedChange={(v) => setIds(t.itemIds, v === true)}
                            aria-label={`Include ${t.technician_name}'s ${line.name}`}
                          />
                          <span className="flex-1">{t.technician_name}</span>
                          <span className="font-semibold tabular-nums text-foreground">× {t.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hidden px-3 pb-3 pl-11 text-xs text-muted-foreground md:block">
                      {line.technicians.map((t) => `${t.technician_name} ${t.quantity}`).join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {techGroups.map((g) => (
            <div key={g.technician_id} className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2.5">
                <Checkbox checked={checkState(g.itemIds, selected)} onCheckedChange={(v) => setIds(g.itemIds, v === true)} aria-label={`Include all items for ${g.technician_name}`} />
                <span className="flex-1 font-medium">{g.technician_name}</span>
                <span className="text-xs text-muted-foreground">
                  {plural(g.lines.length, "product")} · {plural(g.requestIds.length, "request")}
                </span>
              </div>
              <ul className="divide-y">
                {g.lines.map((l) => (
                  <li key={l.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Checkbox checked={checkState(l.itemIds, selected)} onCheckedChange={(v) => setIds(l.itemIds, v === true)} aria-label={`Include ${l.name} for ${g.technician_name}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{l.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.grainger_sku ? `SKU ${l.grainger_sku}` : l.is_custom ? "Other item" : "No SKU"}
                        {l.notes[0] && ` · “${l.notes[0]}”`}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">× {l.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-20 z-20 mt-4 lg:bottom-4">
        <div className="flex flex-col gap-2 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">
            <span className="font-semibold">{plural(chosen.length, "line")}</span>{" "}
            <span className="text-muted-foreground">
              selected · {plural(chosenTechCount, "technician")} · {plural(chosenRequestCount, "request")}
            </span>
          </p>
          <Button variant="success" size="lg" disabled={chosen.length === 0} onClick={() => setOrderOpen(true)}>
            <PackageCheck /> Mark selected ordered
          </Button>
        </div>
      </div>

      <Dialog open={requestsOpen} onOpenChange={setRequestsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Requests in this order</DialogTitle>
            <DialogDescription>Choose which outstanding requests to include in {teamName}&apos;s next Grainger order.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="divide-y rounded-xl border">
              {requests.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                    <Checkbox
                      checked={!excludedRequests.has(r.id)}
                      onCheckedChange={(v) =>
                        setExcludedRequests((s) => {
                          const next = new Set(s);
                          if (v === true) next.delete(r.id);
                          else next.add(r.id);
                          return next;
                        })
                      }
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{r.technician}</span>
                      <span className="text-xs text-muted-foreground" title={formatDate(r.created_at)}>
                        {timeAgo(r.created_at)} · {plural(r.count, "item")} outstanding
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcludedRequests(new Set(requests.map((r) => r.id)))}>
              Include none
            </Button>
            <Button variant="outline" onClick={() => setExcludedRequests(new Set())}>
              Include all
            </Button>
            <Button onClick={() => setRequestsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MarkOrderedDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        summary={`${plural(chosen.length, "line")} for ${plural(chosenTechCount, "technician")} will be marked ordered. Anything unchecked stays requested.`}
        onConfirm={async (reference) => {
          const res = await markItemsOrdered(teamId, chosen.map((i) => i.id), reference);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Marked ${plural(res.count ?? 0, "item")} ordered`);
          setOrderOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
