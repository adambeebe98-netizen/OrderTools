"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList, PackageCheck, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { MarkOrderedDialog } from "@/components/admin/mark-ordered-dialog";
import { markRequestsOrdered } from "@/lib/actions/requests";
import type { AdminRequest, RequestFilters } from "@/lib/data/admin";
import { cn, formatDateTime, formatQty, plural, timeAgo } from "@/lib/utils";

export function RequestsView({
  teamId,
  requests,
  total,
  pageSize,
  filters,
  technicians,
  lastSeen,
}: {
  teamId: string;
  requests: AdminRequest[];
  total: number;
  pageSize: number;
  filters: RequestFilters;
  technicians: { id: string; name: string }[];
  lastSeen: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = React.useState(filters.q ?? "");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isNavigating, startTransition] = React.useTransition();

  // Clear selection when the visible data changes.
  React.useEffect(() => setSelected(new Set()), [requests]);

  const setParam = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      if (!("page" in updates)) params.delete("page");
      params.delete("new");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  // Debounced search.
  React.useEffect(() => {
    if ((filters.q ?? "") === q) return;
    const t = setTimeout(() => setParam({ q: q.trim() || undefined }), 300);
    return () => clearTimeout(t);
  }, [q, filters.q, setParam]);

  const selectable = requests.filter((r) => r.items.some((i) => i.status === "requested"));
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0 && !allSelected;
  const selectedItems = requests
    .filter((r) => selected.has(r.id))
    .reduce((n, r) => n + r.items.filter((i) => i.status === "requested").length, 0);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const base = `/admin/${teamId}`;

  return (
    <div className={cn("grid gap-4 transition-opacity", isNavigating && "opacity-60")}>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            placeholder="Search items or technicians"
            aria-label="Search items or technicians"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:contents">
          <NativeSelect aria-label="Status" value={filters.status} onChange={(e) => setParam({ status: e.target.value })} className="sm:w-36">
            <option value="requested">Requested</option>
            <option value="ordered">Ordered</option>
            <option value="all">All statuses</option>
          </NativeSelect>
          <NativeSelect
            aria-label="Technician"
            value={filters.technician ?? ""}
            onChange={(e) => setParam({ technician: e.target.value || undefined })}
            className="sm:w-44"
          >
            <option value="">All technicians</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Sort" value={filters.sort} onChange={(e) => setParam({ sort: e.target.value })} className="sm:w-36">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </NativeSelect>
        </div>
      </div>

      {(filters.q || filters.technician || filters.status !== "requested") && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{plural(total, "request")}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setParam({ q: undefined, technician: undefined, status: undefined });
            }}
          >
            <X /> Clear filters
          </Button>
        </div>
      )}

      {requests.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={filters.status === "requested" && !filters.q && !filters.technician ? "No outstanding requests" : "No matching requests"}
          description={
            filters.status === "requested" && !filters.q && !filters.technician
              ? "New requests from your technicians will show up here."
              : "Try a different search or filter."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.id)))}
              aria-label="Select all outstanding requests on this page"
              disabled={selectable.length === 0}
            />
            <span className="flex-1 text-xs font-medium text-muted-foreground">
              {selected.size > 0 ? `${plural(selected.size, "request")} selected · ${plural(selectedItems, "item")}` : "Select requests to mark ordered"}
            </span>
            {selected.size > 0 && (
              <Button size="sm" variant="success" onClick={() => setDialogOpen(true)}>
                <PackageCheck /> Mark ordered
              </Button>
            )}
          </div>
          <ul className="divide-y">
            {requests.map((r) => {
              const open = r.items.filter((i) => i.status === "requested").length;
              const isNew = r.created_at > lastSeen;
              return (
                <li key={r.id} className={cn("flex items-start gap-3 px-3 py-3", selected.has(r.id) && "bg-accent/40")}>
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggle(r.id)}
                    disabled={open === 0}
                    aria-label={`Select request from ${r.technician_name}`}
                  />
                  <Link href={`${base}/requests/${r.id}`} className="group min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium group-hover:underline">{r.technician_name}</span>
                      {isNew && <Badge variant="primary">New</Badge>}
                      <StatusBadge status={r.status} />
                      {r.status === "requested" && open < r.items.length && (
                        <Badge variant="outline">
                          {r.items.length - open} of {r.items.length} ordered
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground" title={formatDateTime(r.created_at)}>
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {r.items.map((i, idx) => (
                        <span key={i.id} className={i.status === "ordered" && r.status === "requested" ? "line-through opacity-60" : ""}>
                          {idx > 0 && ", "}
                          {i.name} ×{formatQty(i.quantity, i.unit)}
                        </span>
                      ))}
                    </p>
                    {r.note && <p className="mt-1 truncate text-xs italic text-muted-foreground">“{r.note}”</p>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {filters.page} of {pages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={filters.page <= 1} onClick={() => setParam({ page: String(filters.page - 1) })}>
              <ChevronLeft /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={filters.page >= pages} onClick={() => setParam({ page: String(filters.page + 1) })}>
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <MarkOrderedDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        summary={`${plural(selectedItems, "outstanding item")} across ${plural(selected.size, "request")} will be marked ordered. Technicians will see the new status.`}
        onConfirm={async (reference) => {
          const res = await markRequestsOrdered(teamId, [...selected], reference);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Marked ${plural(res.count ?? 0, "item")} ordered`);
          setDialogOpen(false);
          setSelected(new Set());
          router.refresh();
        }}
      />
    </div>
  );
}
