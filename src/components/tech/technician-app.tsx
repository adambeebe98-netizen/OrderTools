"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Package, PackagePlus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/misc";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PublicCatalogItem, PublicCategory } from "@/lib/data/public";
import { cn, formatQty, plural, safeHttpUrl } from "@/lib/utils";
import { ChangeNameDialog, NameGate, QuantityStepper, TechHeader, useLocalJson, useTechnicianName } from "./shared";

type CustomLine = { key: string; name: string; quantity: number; note: string; url: string };
type Cart = { items: Record<string, number>; custom: CustomLine[]; note: string };
const EMPTY_CART: Cart = { items: {}, custom: [], note: "" };

type SubmittedSummary = { id: string; lines: { name: string; quantity: number; unit: string | null }[] };

export function TechnicianApp({
  slug,
  teamName,
  categories,
  items,
}: {
  slug: string;
  teamName: string;
  categories: PublicCategory[];
  items: PublicCatalogItem[];
}) {
  const [name, setName] = useTechnicianName();
  const [cart, setCart] = useLocalJson<Cart>(`supply-portal:cart:${slug}`, EMPTY_CART);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<string | "all">("all");
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [otherOpen, setOtherOpen] = React.useState(false);
  const [nameOpen, setNameOpen] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<SubmittedSummary | null>(null);

  const itemsById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Drop cart entries for items that were archived since the cart was saved.
  const cartItems = Object.entries(cart.items).filter(([id, qty]) => itemsById.has(id) && qty > 0);
  const lineCount = cartItems.length + cart.custom.length;

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c.items };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return { ...c, items: next };
    });

  const filtered = React.useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((i) => {
      if (category !== "all" && !terms.length && (i.category_id ?? "uncategorized") !== category) return false;
      if (!terms.length) return true;
      const hay = `${i.name} ${i.description ?? ""} ${i.grainger_sku ?? ""}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [items, query, category]);

  const grouped = React.useMemo(() => {
    const order = [...categories, { id: "uncategorized", name: "Other supplies" }];
    return order
      .map((c) => ({ ...c, items: filtered.filter((i) => (i.category_id ?? "uncategorized") === c.id) }))
      .filter((g) => g.items.length > 0);
  }, [categories, filtered]);

  const hasUncategorized = items.some((i) => !i.category_id);

  if (name === undefined) return <div className="min-h-dvh" aria-busy />;
  if (!name) return <NameGate teamName={teamName} onSave={setName} />;

  if (submitted) {
    return (
      <>
        <TechHeader slug={slug} teamName={teamName} name={name} onChangeName={() => setNameOpen(true)} active="catalog" />
        <SuccessScreen
          slug={slug}
          summary={submitted}
          onNew={() => {
            setSubmitted(null);
            window.scrollTo({ top: 0 });
          }}
        />
        <ChangeNameDialog open={nameOpen} onOpenChange={setNameOpen} name={name} onSave={setName} />
      </>
    );
  }

  return (
    <div className="min-h-dvh pb-28">
      <TechHeader slug={slug} teamName={teamName} name={name} onChangeName={() => setNameOpen(true)} active="catalog" />

      <div className="sticky top-14 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Search supplies…"
              aria-label="Search supplies"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 rounded-xl pl-11 pr-11 text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {!query && categories.length > 0 && (
            <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Categories">
              {[{ id: "all", name: "All" }, ...categories, ...(hasUncategorized ? [{ id: "uncategorized", name: "Other" }] : [])].map(
                (c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={category === c.id}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
                      category === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    {c.name}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {items.length === 0 && (
          <p className="mb-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Your manager hasn&apos;t added catalog items yet. Use &ldquo;Request another item&rdquo; below.
          </p>
        )}

        {grouped.map((g) => (
          <section key={g.id} className="mb-6" aria-labelledby={`cat-${g.id}`}>
            <h2 id={`cat-${g.id}`} className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.name}
            </h2>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {g.items.map((item) => (
                <CatalogRow key={item.id} item={item} qty={cart.items[item.id] ?? 0} onQty={(q) => setQty(item.id, q)} />
              ))}
            </ul>
          </section>
        ))}

        {query && filtered.length === 0 && (
          <div className="mb-6 rounded-xl border border-dashed p-6 text-center">
            <p className="font-medium">No matches for &ldquo;{query}&rdquo;</p>
            <p className="mt-1 text-sm text-muted-foreground">You can still request it as another item.</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOtherOpen(true)}
          className="mb-6 flex w-full items-center gap-3 rounded-xl border border-dashed bg-card p-4 text-left hover:bg-muted"
        >
          <span className="rounded-lg bg-accent p-2.5 text-accent-foreground">
            <PackagePlus className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block font-medium">Request another item</span>
            <span className="block text-sm text-muted-foreground">Can&apos;t find it? Describe what you need.</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
        </button>
      </main>

      {lineCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 pt-3 pb-safe backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <Button size="xl" className="w-full justify-between" onClick={() => setReviewOpen(true)}>
              <span className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-white/20 text-sm tabular-nums">{lineCount}</span>
                Review request
              </span>
              <ChevronRight className="size-5" aria-hidden />
            </Button>
          </div>
        </div>
      )}

      <OtherItemDialog
        open={otherOpen}
        onOpenChange={setOtherOpen}
        initialName={query}
        onAdd={(line) => {
          setCart((c) => ({ ...c, custom: [...c.custom, line] }));
          toast.success(`Added “${line.name}”`);
        }}
      />

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        slug={slug}
        name={name}
        cart={cart}
        setCart={setCart}
        itemsById={itemsById}
        onSubmitted={(summary) => {
          setCart(EMPTY_CART);
          setReviewOpen(false);
          setQuery("");
          setSubmitted(summary);
          window.scrollTo({ top: 0 });
        }}
      />

      <ChangeNameDialog open={nameOpen} onOpenChange={setNameOpen} name={name} onSave={setName} />
    </div>
  );
}

function ItemThumb({ item }: { item: Pick<PublicCatalogItem, "image_url" | "name"> }) {
  const src = safeHttpUrl(item.image_url);
  const [failed, setFailed] = React.useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-12 shrink-0 rounded-lg border bg-muted object-cover"
      />
    );
  }
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
      <Package className="size-5" />
    </span>
  );
}

function CatalogRow({ item, qty, onQty }: { item: PublicCatalogItem; qty: number; onQty: (q: number) => void }) {
  return (
    <li className={cn("flex items-center gap-3 p-3", qty > 0 && "bg-accent/40")}>
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{item.name}</p>
        {(item.description || (item.unit && item.unit !== "each")) && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {item.unit && item.unit !== "each" && <span className="font-medium">Per {item.unit}. </span>}
            {item.description}
          </p>
        )}
      </div>
      {qty > 0 ? (
        <QuantityStepper value={qty} onChange={onQty} label={item.name} />
      ) : (
        <Button variant="outline" size="lg" className="h-11 shrink-0 rounded-xl px-5" onClick={() => onQty(1)} aria-label={`Add ${item.name}`}>
          Add
        </Button>
      )}
    </li>
  );
}

function OtherItemDialog({
  open,
  onOpenChange,
  initialName,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialName: string;
  onAdd: (line: CustomLine) => void;
}) {
  const [name, setName] = React.useState("");
  const [qty, setQty] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [errors, setErrors] = React.useState<{ name?: string; url?: string }>({});

  React.useEffect(() => {
    if (open) {
      setName(initialName.trim());
      setQty(1);
      setNote("");
      setUrl("");
      setErrors({});
    }
  }, [open, initialName]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter an item name";
    if (url.trim() && !safeHttpUrl(url.trim())) next.url = "Enter a full link starting with https://";
    setErrors(next);
    if (Object.keys(next).length) return;
    onAdd({ key: crypto.randomUUID(), name: name.trim(), quantity: qty, note: note.trim(), url: url.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Request another item</DialogTitle>
            <DialogDescription>For anything that isn&apos;t in the list.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 pb-4">
            <Field label="Item name" htmlFor="other-name" error={errors.name}>
              <Input id="other-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="h-12" placeholder="e.g. 1/2&quot; cable clamps" aria-invalid={!!errors.name} />
            </Field>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Quantity</span>
              <div>
                <QuantityStepper value={qty} onChange={setQty} label="other item" min={1} />
              </div>
            </div>
            <Field label="Why do you need it? (optional)" htmlFor="other-note">
              <Textarea id="other-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Size, brand, what job it's for…" />
            </Field>
            <Field label="Product link (optional)" htmlFor="other-url" error={errors.url}>
              <Input id="other-url" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.grainger.com/…" aria-invalid={!!errors.url} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              Add to request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  slug,
  name,
  cart,
  setCart,
  itemsById,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slug: string;
  name: string;
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  itemsById: Map<string, PublicCatalogItem>;
  onSubmitted: (summary: SubmittedSummary) => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const honeypot = React.useRef<HTMLInputElement>(null);

  const lines = Object.entries(cart.items)
    .map(([id, qty]) => ({ item: itemsById.get(id), qty, id }))
    .filter((l): l is { item: PublicCatalogItem; qty: number; id: string } => !!l.item && l.qty > 0);

  const total = lines.length + cart.custom.length;

  React.useEffect(() => {
    if (open && total === 0) onOpenChange(false);
  }, [open, total, onOpenChange]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/r/${encodeURIComponent(slug)}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          note: cart.note,
          website: honeypot.current?.value ?? "",
          items: [
            ...lines.map((l) => ({ catalog_item_id: l.id, quantity: l.qty })),
            ...cart.custom.map((c) => ({ custom_name: c.name, quantity: c.quantity, custom_note: c.note, custom_url: c.url })),
          ],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error || "Could not submit your request. Please try again.");
      onSubmitted({
        id: data.id,
        lines: [
          ...lines.map((l) => ({ name: l.item.name, quantity: l.qty, unit: l.item.unit })),
          ...cart.custom.map((c) => ({ name: c.name, quantity: c.quantity, unit: null })),
        ],
      });
    } catch (e) {
      const message =
        e instanceof TypeError ? "No connection. Your request is saved on this phone — try again when you have signal." : (e as Error).message;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review your request</DialogTitle>
          <DialogDescription>
            {plural(total, "item")} · requested by <span className="font-medium text-foreground">{name}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-4">
          <ul className="divide-y rounded-xl border">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{l.item.name}</p>
                  {l.item.unit && l.item.unit !== "each" && <p className="text-xs text-muted-foreground">per {l.item.unit}</p>}
                </div>
                <QuantityStepper
                  size="md"
                  min={1}
                  value={l.qty}
                  label={l.item.name}
                  onChange={(q) => setCart((c) => ({ ...c, items: { ...c.items, [l.id]: q } }))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${l.item.name}`}
                  onClick={() =>
                    setCart((c) => {
                      const next = { ...c.items };
                      delete next[l.id];
                      return { ...c, items: next };
                    })
                  }
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </li>
            ))}
            {cart.custom.map((c) => (
              <li key={c.key} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">
                    {c.name} <Badge variant="custom" className="ml-1 align-middle">Other</Badge>
                  </p>
                  {c.note && <p className="truncate text-xs text-muted-foreground">{c.note}</p>}
                </div>
                <QuantityStepper
                  size="md"
                  min={1}
                  value={c.quantity}
                  label={c.name}
                  onChange={(q) => setCart((cc) => ({ ...cc, custom: cc.custom.map((x) => (x.key === c.key ? { ...x, quantity: q } : x)) }))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => setCart((cc) => ({ ...cc, custom: cc.custom.filter((x) => x.key !== c.key) }))}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
          <Field label="Note for your manager (optional)" htmlFor="request-note" className="mt-4">
            <Textarea
              id="request-note"
              rows={2}
              maxLength={500}
              value={cart.note}
              onChange={(e) => setCart((c) => ({ ...c, note: e.target.value }))}
              placeholder="Anything they should know?"
            />
          </Field>
          {/* Honeypot field for bots — hidden from people and assistive tech. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          {error && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={submitting}>
            Add more
          </Button>
          <Button size="xl" className="sm:h-12" onClick={submit} disabled={submitting || total === 0}>
            {submitting ? <Spinner /> : null}
            {submitting ? "Sending…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuccessScreen({ slug, summary, onNew }: { slug: string; summary: SubmittedSummary; onNew: () => void }) {
  const ref = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => ref.current?.focus(), []);
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-5 py-10 text-center">
      <div className="mb-4 rounded-full bg-success-soft p-4 text-success">
        <CheckCircle2 className="size-12" aria-hidden />
      </div>
      <h1 ref={ref} tabIndex={-1} className="text-2xl font-semibold tracking-tight focus:outline-none">
        Request sent
      </h1>
      <p className="mt-2 text-muted-foreground">Your manager has it. You&apos;ll see the status change to Ordered once it&apos;s placed.</p>
      <ul className="mt-6 w-full divide-y rounded-xl border bg-card text-left">
        {summary.lines.map((l, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 truncate">{l.name}</span>
            <span className="shrink-0 font-semibold tabular-nums">× {formatQty(l.quantity, l.unit)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 grid w-full gap-2">
        <Button size="xl" onClick={onNew}>
          Start another request
        </Button>
        <Button size="xl" variant="outline" asChild>
          <Link href={`/r/${slug}/history`}>View my requests</Link>
        </Button>
      </div>
    </main>
  );
}
