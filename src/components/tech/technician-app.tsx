"use client";

import * as React from "react";
import Link from "next/link";
import {
  Cable,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Drill,
  Flame,
  Hammer,
  Package,
  PackagePlus,
  PlugZap,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
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
import type { PublicCatalogItem, PublicCategory, PublicProductGroup } from "@/lib/data/public";
import { SupplyIcon, isSupplyIconName } from "@/components/icons/supply-icons";
import { groupSummary, resolveSelection, type Attributes } from "@/lib/variants";
import { cn, formatQty, plural, safeHttpUrl } from "@/lib/utils";
import { ChangeNameDialog, NameGate, QuantityStepper, TechHeader, useLocalJson, useTechnicianName } from "./shared";

type CustomLine = { key: string; name: string; quantity: number; note: string; url: string };
type Cart = { items: Record<string, number>; custom: CustomLine[]; note: string };
const EMPTY_CART: Cart = { items: {}, custom: [], note: "" };

type SubmittedSummary = { id: string; lines: { name: string; quantity: number; unit: string | null }[] };

const UNCATEGORIZED = "uncategorized";

/** Pick a category icon from its name, so admins don't have to choose one. */
function categoryIcon(name: string): { icon: LucideIcon; tint: string } {
  const n = name.toLowerCase();
  if (/drill|bit|saw|bore/.test(n)) return { icon: Drill, tint: "bg-sky-500/15 text-sky-300" };
  if (/wir|connect|cable|rj45|low.?volt|network/.test(n)) return { icon: Cable, tint: "bg-violet-500/15 text-violet-300" };
  if (/power|plug|outlet|electric/.test(n)) return { icon: PlugZap, tint: "bg-amber-500/15 text-amber-300" };
  if (/mount|fasten|screw|anchor|hardware|seal|tape|adhes/.test(n)) return { icon: Hammer, tint: "bg-emerald-500/15 text-emerald-300" };
  return { icon: Package, tint: "bg-slate-500/20 text-slate-300" };
}

export function TechnicianApp({
  slug,
  teamName,
  categories,
  groups,
  items,
  popularIds,
}: {
  slug: string;
  teamName: string;
  categories: PublicCategory[];
  groups: PublicProductGroup[];
  items: PublicCatalogItem[];
  popularIds: string[];
}) {
  const [name, setName] = useTechnicianName();
  const [cart, setCart] = useLocalJson<Cart>(`supply-portal:cart:${slug}`, EMPTY_CART);
  const [openCategory, setOpenCategory] = React.useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [otherOpen, setOtherOpen] = React.useState(false);
  const [nameOpen, setNameOpen] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<SubmittedSummary | null>(null);
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);

  const itemsById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const popular = popularIds.map((id) => itemsById.get(id)).filter((i): i is PublicCatalogItem => !!i);

  const groupById = React.useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const iconFor = (item: PublicCatalogItem) => (item.group_id ? groupById.get(item.group_id)?.icon : item.icon) ?? null;

  // Each category lists product groups (one card per group) and standalone items, in display order.
  const sections = React.useMemo(() => {
    const all = [...categories, { id: UNCATEGORIZED, name: "Other supplies" }];
    return all
      .map((c) => {
        const inCat = items.filter((i) => (i.category_id ?? UNCATEGORIZED) === c.id);
        const entries: Entry[] = [
          ...groups
            .filter((g) => (g.category_id ?? UNCATEGORIZED) === c.id)
            .map((g) => ({ kind: "group" as const, group: g, variants: inCat.filter((i) => i.group_id === g.id), sort: g.sort_order }))
            .filter((e) => e.variants.length > 0),
          ...inCat.filter((i) => !i.group_id).map((i) => ({ kind: "item" as const, item: i, sort: i.sort_order })),
        ].sort((a, b) => a.sort - b.sort);
        return { ...c, items: inCat, entries };
      })
      .filter((s) => s.entries.length > 0);
  }, [categories, groups, items]);
  const current = sections.find((g) => g.id === openCategory) ?? null;
  const sheetGroup = openGroup ? groupById.get(openGroup) ?? null : null;
  const sheetVariants = sheetGroup ? items.filter((i) => i.group_id === sheetGroup.id) : [];

  // Phone back button closes a category instead of leaving the page.
  React.useEffect(() => {
    const onPop = (e: PopStateEvent) => setOpenCategory((e.state as { category?: string } | null)?.category ?? null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const showCategory = (id: string) => {
    window.history.pushState({ category: id }, "");
    setOpenCategory(id);
    window.scrollTo({ top: 0 });
  };
  const backToCategories = () => {
    if ((window.history.state as { category?: string } | null)?.category) window.history.back();
    else setOpenCategory(null);
  };

  // Drop cart entries for items that were archived since the cart was saved.
  const cartItems = Object.entries(cart.items).filter(([id, qty]) => itemsById.has(id) && qty > 0);
  const lineCount = cartItems.length + cart.custom.length;
  const addedIn = (g: { items: PublicCatalogItem[] }) => g.items.filter((i) => (cart.items[i.id] ?? 0) > 0).length;

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c.items };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return { ...c, items: next };
    });

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

  const otherItemCard = (
    <button
      type="button"
      onClick={() => setOtherOpen(true)}
      className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-dashed bg-card p-4 text-left hover:bg-muted"
    >
      <span className="rounded-xl bg-accent p-2.5 text-accent-foreground">
        <PackagePlus className="size-5" aria-hidden />
      </span>
      <span className="flex-1">
        <span className="block font-medium">Request another item</span>
        <span className="block text-sm text-muted-foreground">Not in the list? Describe what you need.</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
    </button>
  );

  return (
    <div className="min-h-dvh pb-28">
      <TechHeader slug={slug} teamName={teamName} name={name} onChangeName={() => setNameOpen(true)} active="catalog" />

      {current ? (
        <>
          <div className="sticky top-14 z-20 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-2">
              <Button variant="ghost" size="lg" className="px-3" onClick={backToCategories}>
                <ChevronLeft className="size-5" /> Categories
              </Button>
            </div>
          </div>
          <main className="mx-auto max-w-2xl px-4 pt-4">
            <h1 className="mb-3 flex items-center gap-3 text-xl font-semibold tracking-tight">
              <CategoryIcon name={current.name} />
              {current.name}
            </h1>
            <ul className="mb-6 divide-y overflow-hidden rounded-2xl border bg-card">
              {current.entries.map((e) =>
                e.kind === "group" ? (
                  <GroupRow
                    key={e.group.id}
                    group={e.group}
                    variants={e.variants}
                    added={e.variants.filter((v) => (cart.items[v.id] ?? 0) > 0).length}
                    onOpen={() => setOpenGroup(e.group.id)}
                  />
                ) : (
                  <CatalogRow
                    key={e.item.id}
                    item={e.item}
                    icon={iconFor(e.item)}
                    qty={cart.items[e.item.id] ?? 0}
                    onQty={(q) => setQty(e.item.id, q)}
                  />
                ),
              )}
            </ul>
            {otherItemCard}
          </main>
        </>
      ) : (
        <main className="mx-auto max-w-2xl px-4 pt-5">
          {popular.length > 0 && (
            <section className="mb-7" aria-labelledby="popular-heading">
              <h2 id="popular-heading" className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-muted-foreground">
                <Flame className="size-4 text-amber-400" aria-hidden /> Most ordered
              </h2>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {popular.map((item) => (
                  <CatalogRow
                    key={item.id}
                    item={item}
                    icon={iconFor(item)}
                    qty={cart.items[item.id] ?? 0}
                    onQty={(q) => setQty(item.id, q)}
                  />
                ))}
              </ul>
            </section>
          )}

          {sections.length > 0 ? (
            <section className="mb-6" aria-labelledby="categories-heading">
              <h2 id="categories-heading" className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
                Categories
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {sections.map((g) => {
                  const added = addedIn(g);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => showCategory(g.id)}
                      className="relative flex min-h-32 flex-col justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-input hover:bg-muted active:scale-[0.98]"
                    >
                      <CategoryIcon name={g.name} size="lg" />
                      <span>
                        <span className="block font-semibold leading-snug">{g.name}</span>
                        <span className="text-sm text-muted-foreground">{plural(g.entries.length, "product")}</span>
                      </span>
                      {added > 0 && (
                        <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                          {added} added
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <p className="mb-6 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Your manager hasn&apos;t added catalog items yet. Use &ldquo;Request another item&rdquo; below.
            </p>
          )}

          {otherItemCard}
        </main>
      )}

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
        initialName=""
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
          setOpenCategory(null);
          setSubmitted(summary);
          window.scrollTo({ top: 0 });
        }}
      />

      <VariantSheet
        group={sheetGroup}
        variants={sheetVariants}
        cart={cart.items}
        onClose={() => setOpenGroup(null)}
        onAdd={(variant, qty) => {
          setQty(variant.id, (cart.items[variant.id] ?? 0) + qty);
          toast.success(`Added ${variant.name} × ${qty}`);
          setOpenGroup(null);
        }}
        onRemove={(variant) => setQty(variant.id, 0)}
      />

      <ChangeNameDialog open={nameOpen} onOpenChange={setNameOpen} name={name} onSave={setName} />
    </div>
  );
}

type Entry =
  | { kind: "group"; group: PublicProductGroup; variants: PublicCatalogItem[]; sort: number }
  | { kind: "item"; item: PublicCatalogItem; sort: number };

function ProductIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  return (
    <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/85", className)} aria-hidden>
      {isSupplyIconName(icon) ? <SupplyIcon name={icon} className="size-7" /> : <Package className="size-6 text-muted-foreground" />}
    </span>
  );
}

function GroupRow({
  group,
  variants,
  added,
  onOpen,
}: {
  group: PublicProductGroup;
  variants: PublicCatalogItem[];
  added: number;
  onOpen: () => void;
}) {
  const summary = groupSummary(variants, group.attribute_names);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn("flex w-full items-center gap-3 p-3 text-left hover:bg-muted/60 active:bg-muted", added > 0 && "bg-accent/40")}
        aria-label={`Choose ${group.name}`}
      >
        <ProductIcon icon={group.icon} />
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-snug">{group.name}</span>
          <span className="block truncate text-sm text-muted-foreground">{summary || group.description}</span>
        </span>
        {added > 0 && <Badge variant="primary">{added} added</Badge>}
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/15 text-primary">
          <ChevronRight className="size-5" />
        </span>
      </button>
    </li>
  );
}

/** One bottom sheet: pick each attribute (auto-picked when there's one option), set quantity, add. */
function VariantSheet({
  group,
  variants,
  cart,
  onClose,
  onAdd,
  onRemove,
}: {
  group: PublicProductGroup | null;
  variants: PublicCatalogItem[];
  cart: Record<string, number>;
  onClose: () => void;
  onAdd: (variant: PublicCatalogItem, qty: number) => void;
  onRemove: (variant: PublicCatalogItem) => void;
}) {
  const [picked, setPicked] = React.useState<Attributes>({});
  const [qty, setQty] = React.useState(1);
  React.useEffect(() => {
    setPicked({});
    setQty(1);
  }, [group?.id]);

  const resolved = group ? resolveSelection(variants, group.attribute_names, picked) : null;
  const variant = resolved?.variant ? (variants.find((v) => v.id === resolved.variant!.id) ?? null) : null;
  const inCart = variants.filter((v) => (cart[v.id] ?? 0) > 0);
  const remaining = resolved ? resolved.steps.filter((s) => !s.value).map((s) => s.name.toLowerCase()) : [];

  return (
    <Dialog open={!!group} onOpenChange={(o) => !o && onClose()}>
      {/* Don't auto-focus the quantity field: it would pop the phone keyboard. */}
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        {group && resolved && (
          <>
            <DialogHeader className="flex-row items-center gap-3">
              <ProductIcon icon={group.icon} className="size-11" />
              <div className="min-w-0">
                <DialogTitle>{group.name}</DialogTitle>
                {group.description && <DialogDescription>{group.description}</DialogDescription>}
              </div>
            </DialogHeader>
            <DialogBody className="grid gap-5 pb-4">
              {resolved.steps.map((step) => (
                <fieldset key={step.name} className="grid gap-2">
                  <legend className="mb-2 text-sm font-medium text-muted-foreground">{step.name}</legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={step.name}>
                    {step.options.map((option) => {
                      const selected = step.value === option;
                      const only = step.options.length === 1;
                      return (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={only}
                          onClick={() => setPicked((p) => ({ ...resolved.selection, ...p, [step.name]: option }))}
                          className={cn(
                            "h-12 min-w-16 rounded-xl border px-4 text-base font-medium transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card hover:border-input hover:bg-muted active:bg-muted",
                            only && "disabled:opacity-100",
                          )}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}

              <div className="grid gap-2">
                <span className="text-sm font-medium text-muted-foreground">Quantity</span>
                <div className="flex items-center justify-between gap-3">
                  <QuantityStepper value={qty} onChange={setQty} label={group.name} min={1} />
                  {variant?.unit && variant.unit !== "each" && <span className="text-sm text-muted-foreground">per {variant.unit}</span>}
                </div>
              </div>

              {inCart.length > 0 && (
                <div className="grid gap-1.5 rounded-xl border bg-muted/40 p-3 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Already in your request</span>
                  {inCart.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {v.name} <span className="text-muted-foreground">× {cart[v.id]}</span>
                      </span>
                      <button type="button" onClick={() => onRemove(v)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={`Remove ${v.name}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button size="xl" className="w-full sm:h-12" disabled={!variant} onClick={() => variant && onAdd(variant, qty)}>
                <Plus className="size-5" />
                {variant ? `Add to request` : `Choose ${remaining.join(" and ")}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryIcon({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const { icon: Icon, tint } = categoryIcon(name);
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl", tint, size === "lg" ? "size-12" : "size-9")} aria-hidden>
      <Icon className={size === "lg" ? "size-6" : "size-5"} />
    </span>
  );
}

function ItemThumb({ item, icon }: { item: Pick<PublicCatalogItem, "image_url" | "name">; icon?: string | null }) {
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
  // No photo: show the product's line icon, or nothing so the list stays clean.
  return isSupplyIconName(icon) ? <ProductIcon icon={icon} /> : null;
}

function CatalogRow({
  item,
  icon,
  qty,
  onQty,
}: {
  item: PublicCatalogItem;
  icon?: string | null;
  qty: number;
  onQty: (q: number) => void;
}) {
  return (
    <li className={cn("flex items-center gap-3 p-3", qty > 0 && "bg-accent/40")}>
      <ItemThumb item={item} icon={icon} />
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
        <button
          type="button"
          onClick={() => onQty(1)}
          aria-label={`Add ${item.name}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 active:scale-95"
        >
          <Plus className="size-5" />
        </button>
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
