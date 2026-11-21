"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import type { PublicHistoryRequest } from "@/lib/data/public";
import { HISTORY_DAYS } from "@/lib/history-constants";
import { formatDate, formatQty, plural } from "@/lib/utils";
import { ChangeNameDialog, NameGate, TechHeader, useTechnicianName } from "./shared";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; requests: PublicHistoryRequest[] };

export function TechnicianHistory({ slug, teamName }: { slug: string; teamName: string }) {
  const [name, setName] = useTechnicianName();
  const [nameOpen, setNameOpen] = React.useState(false);
  const [state, setState] = React.useState<State>({ kind: "loading" });

  const load = React.useCallback(async () => {
    if (!name) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/r/${encodeURIComponent(slug)}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { requests?: PublicHistoryRequest[]; error?: string };
      if (!res.ok || !data.requests) throw new Error(data.error || "Could not load your requests.");
      setState({ kind: "ready", requests: data.requests });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof TypeError ? "No connection. Pull down or tap retry when you have signal." : (e as Error).message,
      });
    }
  }, [name, slug]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (name === undefined) return <div className="min-h-dvh" aria-busy />;
  if (!name) return <NameGate teamName={teamName} onSave={setName} />;

  const open = state.kind === "ready" ? state.requests.filter((r) => r.status === "requested") : [];
  const done = state.kind === "ready" ? state.requests.filter((r) => r.status === "ordered") : [];

  return (
    <div className="min-h-dvh pb-10">
      <TechHeader slug={slug} teamName={teamName} name={name} onChangeName={() => setNameOpen(true)} active="history" />
      <main className="mx-auto max-w-2xl px-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">My requests</h1>
            <p className="text-sm text-muted-foreground">Requests made as &ldquo;{name}&rdquo; in the last {HISTORY_DAYS} days.</p>
          </div>
          <Button variant="outline" size="icon" onClick={load} aria-label="Refresh" disabled={state.kind === "loading"}>
            <RefreshCw className={state.kind === "loading" ? "animate-spin" : ""} />
          </Button>
        </div>

        {state.kind === "loading" && (
          <div className="grid gap-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        )}

        {state.kind === "error" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
            {state.message}{" "}
            <button type="button" className="font-medium underline" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {state.kind === "ready" && state.requests.length === 0 && (
          <EmptyState
            icon={<ClipboardList />}
            title="No requests yet"
            description="Requests you submit with this name will show up here."
            action={
              <Button asChild>
                <Link href={`/r/${slug}`}>Request supplies</Link>
              </Button>
            }
          />
        )}

        {open.length > 0 && <RequestSection title="Waiting to be ordered" requests={open} />}
        {done.length > 0 && <RequestSection title="Ordered" requests={done} />}

        {state.kind === "ready" && state.requests.length > 0 && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Don&apos;t see a request? Make sure your name matches what you used when you submitted it.
          </p>
        )}
      </main>
      <ChangeNameDialog open={nameOpen} onOpenChange={setNameOpen} name={name} onSave={setName} />
    </div>
  );
}

function RequestSection({ title, requests }: { title: string; requests: PublicHistoryRequest[] }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <ul className="grid gap-3">
        {requests.map((r) => {
          const orderedCount = r.items.filter((i) => i.status === "ordered").length;
          const partial = r.status === "requested" && orderedCount > 0;
          return (
            <li key={r.id} className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{formatDate(r.created_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {plural(r.items.length, "item")}
                    {partial && ` · ${orderedCount} of ${r.items.length} ordered`}
                    {r.status === "ordered" && r.ordered_at && ` · ordered ${formatDate(r.ordered_at)}`}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <ul className="grid gap-1.5 text-sm">
                {r.items.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate">
                      {i.name}
                      {i.is_custom && (
                        <Badge variant="custom" className="ml-1.5">
                          Other
                        </Badge>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="tabular-nums text-muted-foreground">× {formatQty(i.quantity, i.unit)}</span>
                      {partial && (
                        <span
                          className={i.status === "ordered" ? "size-2 rounded-full bg-success" : "size-2 rounded-full bg-warning"}
                          title={i.status === "ordered" ? "Ordered" : "Requested"}
                          aria-label={i.status === "ordered" ? "Ordered" : "Requested"}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {r.note && <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">Note: {r.note}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
