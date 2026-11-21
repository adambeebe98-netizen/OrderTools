"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState, Spinner } from "@/components/ui/misc";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SUPPLY_ICON_OPTIONS, SupplyIcon, isSupplyIconName } from "@/components/icons/supply-icons";
import {
  deleteCatalogItem,
  deleteProductGroup,
  reorderEntries,
  saveProductGroup,
  saveVariant,
  setCatalogItemArchived,
  setProductGroupArchived,
} from "@/lib/actions/catalog";
import { MAX_ATTRIBUTES, variantName, type Attributes } from "@/lib/variants";
import { cn, plural, safeHttpUrl } from "@/lib/utils";

export type AdminCategory = { id: string; name: string; sort_order: number; archived_at: string | null };
export type AdminGroup = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category_id: string | null;
  attribute_names: string[];
  sort_order: number;
  archived_at: string | null;
};
export type AdminItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  unit: string | null;
  grainger_sku: string | null;
  grainger_url: string | null;
  category_id: string | null;
  group_id: string | null;
  attributes: Attributes;
  icon: string | null;
  sort_order: number;
  archived_at: string | null;
};

type Entry = { kind: "group"; group: AdminGroup; sort: number } | { kind: "item"; item: AdminItem; sort: number };

const NONE = "__none__";

export function IconBadge({ icon, className }: { icon: string | null | undefined; className?: string }) {
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/85", className)} aria-hidden>
      {isSupplyIconName(icon) ? <SupplyIcon name={icon} className="size-6" /> : <Package className="size-4 text-muted-foreground" />}
    </span>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9" role="radiogroup" aria-label="Icon">
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        title="No icon"
        onClick={() => onChange("")}
        className={cn(
          "flex aspect-square items-center justify-center rounded-lg border text-xs text-muted-foreground",
          !value ? "border-primary bg-primary/15" : "hover:bg-muted",
        )}
      >
        None
      </button>
      {SUPPLY_ICON_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          title={o.label}
          aria-label={o.label}
          onClick={() => onChange(o.key)}
          className={cn(
            "flex aspect-square items-center justify-center rounded-lg border",
            value === o.key ? "border-primary bg-primary/15 text-primary" : "text-foreground/85 hover:bg-muted",
          )}
        >
          <SupplyIcon name={o.key} className="size-6" />
        </button>
      ))}
    </div>
  );
}

export function ProductsTab({
  teamId,
  categories,
  groups,
  items,
  requestedIds,
  onEditItem,
  onAddItem,
}: {
  teamId: string;
  categories: AdminCategory[];
  groups: AdminGroup[];
  items: AdminItem[];
  requestedIds: string[];
  onEditItem: (item: AdminItem) => void;
  onAddItem: () => void;
}) {
  const router = useRouter();
  const [showArchived, setShowArchived] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [groupDialog, setGroupDialog] = React.useState<{ group: AdminGroup | null } | null>(null);
  const [variantDialog, setVariantDialog] = React.useState<{ group: AdminGroup; variant: AdminItem | null } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const requested = React.useMemo(() => new Set(requestedIds), [requestedIds]);

  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg?: string) => {
    setBusy(true);
    const res = await p;
    setBusy(false);
    if (!res.ok) return void toast.error(res.error ?? "Something went wrong");
    if (msg) toast.success(msg);
    router.refresh();
  };

  const variantsOf = (g: AdminGroup) =>
    items.filter((i) => i.group_id === g.id).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (text: string) => terms.every((t) => text.toLowerCase().includes(t));
  const itemText = (i: AdminItem) => `${i.name} ${i.grainger_sku ?? ""}`;

  const sections = [...categories, { id: NONE, name: "No category", sort_order: 9999, archived_at: null }]
    .map((c) => {
      const all: Entry[] = [
        ...groups.filter((g) => (g.category_id ?? NONE) === c.id).map((g) => ({ kind: "group" as const, group: g, sort: g.sort_order })),
        ...items.filter((i) => !i.group_id && (i.category_id ?? NONE) === c.id).map((i) => ({ kind: "item" as const, item: i, sort: i.sort_order })),
      ].sort((a, b) => a.sort - b.sort);
      const visible = all.filter((e) => {
        if (e.kind === "item") return (showArchived || !e.item.archived_at) && (!terms.length || hit(itemText(e.item)));
        if (!showArchived && e.group.archived_at) return false;
        return !terms.length || hit(e.group.name) || variantsOf(e.group).some((v) => hit(itemText(v)));
      });
      return { category: c, all, visible };
    })
    .filter((s) => s.visible.length > 0);

  const move = (all: Entry[], entry: Entry, dir: -1 | 1) => {
    const idx = all.indexOf(entry);
    const j = idx + dir;
    if (j < 0 || j >= all.length) return;
    const next = [...all];
    [next[idx], next[j]] = [next[j], next[idx]];
    run(reorderEntries(teamId, next.map((e) => ({ kind: e.kind, id: e.kind === "group" ? e.group.id : e.item.id }))));
  };
  const moveVariant = (variants: AdminItem[], idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= variants.length) return;
    const next = [...variants];
    [next[idx], next[j]] = [next[j], next[idx]];
    run(reorderEntries(teamId, next.map((v) => ({ kind: "item" as const, id: v.id }))));
  };
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const orderButtons = (onUp: () => void, onDown: () => void, first: boolean, last: boolean, label: string) => (
    <div className="flex flex-col">
      <button type="button" className="rounded p-0.5 hover:bg-muted disabled:opacity-25" onClick={onUp} disabled={first || busy} aria-label={`Move ${label} up`}>
        <ArrowUp className="size-3.5" />
      </button>
      <button type="button" className="rounded p-0.5 hover:bg-muted disabled:opacity-25" onClick={onDown} disabled={last || busy} aria-label={`Move ${label} down`}>
        <ArrowDown className="size-3.5" />
      </button>
    </div>
  );

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input placeholder="Search name or SKU" aria-label="Search catalog" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived
        </label>
        <Button variant="outline" onClick={() => setGroupDialog({ group: null })}>
          <Layers /> Add product group
        </Button>
        <Button onClick={onAddItem}>
          <Plus /> Add item
        </Button>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        A <span className="font-medium text-foreground">product group</span> is one card for technicians (like &ldquo;Long Bit&rdquo;) with variants
        they pick from (Type, Size…). Each variant is its own item with its own SKU. Use <span className="font-medium text-foreground">Add item</span>{" "}
        for simple products with no options.
      </p>

      {sections.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title={items.length === 0 && groups.length === 0 ? "Your catalog is empty" : "No matching products"}
          description={items.length === 0 ? "Add products one at a time or import a CSV." : "Try a different search."}
        />
      ) : (
        <div className={cn("grid gap-5", busy && "opacity-70")}>
          {sections.map(({ category, all, visible }) => (
            <section key={category.id}>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category.name}
                {category.archived_at && " (archived)"}
              </h3>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {visible.map((entry) => {
                  const idx = all.indexOf(entry);
                  if (entry.kind === "item") {
                    const item = entry.item;
                    return (
                      <li key={item.id} className={cn("flex items-center gap-2 px-2 py-2.5 sm:gap-3 sm:px-3", item.archived_at && "opacity-60")}>
                        {orderButtons(() => move(all, entry, -1), () => move(all, entry, 1), idx === 0, idx === all.length - 1, item.name)}
                        <ItemVisual item={item} icon={item.icon} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {item.archived_at && <Badge variant="outline">Archived</Badge>}
                          </div>
                          <ItemMeta item={item} />
                        </div>
                        <ItemActions
                          item={item}
                          canDelete={!requested.has(item.id)}
                          onEdit={() => onEditItem(item)}
                          onArchive={() => run(setCatalogItemArchived(teamId, item.id, !item.archived_at), item.archived_at ? "Restored" : "Archived")}
                          onDelete={() => confirm(`Delete ${item.name}? This can't be undone.`) && run(deleteCatalogItem(teamId, item.id), "Deleted")}
                        />
                      </li>
                    );
                  }
                  const g = entry.group;
                  const variants = variantsOf(g).filter((v) => showArchived || !v.archived_at);
                  const activeCount = variantsOf(g).filter((v) => !v.archived_at).length;
                  const isOpen = expanded.has(g.id) || terms.length > 0;
                  return (
                    <li key={g.id} className={cn(g.archived_at && "opacity-60")}>
                      <div className="flex items-center gap-2 px-2 py-2.5 sm:gap-3 sm:px-3">
                        {orderButtons(() => move(all, entry, -1), () => move(all, entry, 1), idx === 0, idx === all.length - 1, g.name)}
                        <button type="button" onClick={() => toggle(g.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                          <IconBadge icon={g.icon} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{g.name}</span>
                              <Badge variant="custom">Group</Badge>
                              {g.archived_at && <Badge variant="outline">Archived</Badge>}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {plural(activeCount, "variant")} · picks {g.attribute_names.join(" → ")}
                            </span>
                          </span>
                          {isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                        </button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit group ${g.name}`} onClick={() => setGroupDialog({ group: g })}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={g.archived_at ? `Restore ${g.name}` : `Archive ${g.name}`}
                          title={g.archived_at ? "Restore" : "Archive (hide from technicians)"}
                          onClick={() => run(setProductGroupArchived(teamId, g.id, !g.archived_at), g.archived_at ? "Group restored" : "Group archived")}
                        >
                          {g.archived_at ? <ArchiveRestore /> : <Archive />}
                        </Button>
                        {variantsOf(g).length === 0 && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${g.name}`}
                            onClick={() => confirm(`Delete group ${g.name}?`) && run(deleteProductGroup(teamId, g.id), "Group deleted")}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                      {isOpen && (
                        <div className="mx-2 mb-3 rounded-lg border bg-background/50 sm:ml-14 sm:mr-3">
                          {variants.length === 0 && <p className="px-3 py-2.5 text-sm text-muted-foreground">No variants yet.</p>}
                          <ul className="divide-y">
                            {variants.map((v, vi) => (
                              <li key={v.id} className={cn("flex items-center gap-2 px-2 py-2 sm:px-3", v.archived_at && "opacity-60")}>
                                {orderButtons(() => moveVariant(variants, vi, -1), () => moveVariant(variants, vi, 1), vi === 0, vi === variants.length - 1, v.name)}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {g.attribute_names.map((n) =>
                                      v.attributes[n] ? (
                                        <span key={n} className="rounded-md border bg-card px-1.5 py-0.5 text-xs">
                                          <span className="text-muted-foreground">{n}:</span> {v.attributes[n]}
                                        </span>
                                      ) : null,
                                    )}
                                    {v.archived_at && <Badge variant="outline">Archived</Badge>}
                                  </div>
                                  <ItemMeta item={v} />
                                </div>
                                <ItemActions
                                  item={v}
                                  canDelete={!requested.has(v.id)}
                                  onEdit={() => setVariantDialog({ group: g, variant: v })}
                                  onArchive={() => run(setCatalogItemArchived(teamId, v.id, !v.archived_at), v.archived_at ? "Restored" : "Archived")}
                                  onDelete={() => confirm(`Delete ${v.name}? This can't be undone.`) && run(deleteCatalogItem(teamId, v.id), "Deleted")}
                                />
                              </li>
                            ))}
                          </ul>
                          <div className="border-t p-2">
                            <Button variant="ghost" size="sm" onClick={() => setVariantDialog({ group: g, variant: null })}>
                              <Plus /> Add variant
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <GroupDialog
        teamId={teamId}
        state={groupDialog}
        categories={categories}
        onClose={() => setGroupDialog(null)}
        onCreated={(group) => {
          setExpanded((s) => new Set(s).add(group.id));
          setVariantDialog({ group, variant: null });
        }}
      />
      <VariantDialog teamId={teamId} state={variantDialog} siblings={variantDialog ? variantsOf(variantDialog.group) : []} onClose={() => setVariantDialog(null)} />
    </>
  );
}

function ItemVisual({ item, icon }: { item: AdminItem; icon: string | null }) {
  const img = safeHttpUrl(item.image_url);
  if (img) return <img src={img} alt="" loading="lazy" className="size-10 shrink-0 rounded-lg border object-cover" />;
  return <IconBadge icon={icon} />;
}

function ItemMeta({ item }: { item: AdminItem }) {
  return (
    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
      {item.unit && item.unit !== "each" && <span>per {item.unit}</span>}
      {item.grainger_sku ? <span className="font-mono">SKU {item.grainger_sku}</span> : <span>No SKU</span>}
      {safeHttpUrl(item.grainger_url) && (
        <a href={item.grainger_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
          Grainger <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}

function ItemActions({
  item,
  canDelete,
  onEdit,
  onArchive,
  onDelete,
}: {
  item: AdminItem;
  canDelete: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.name}`} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={item.archived_at ? `Restore ${item.name}` : `Archive ${item.name}`}
        title={item.archived_at ? "Restore" : "Archive (hide from technicians, keep history)"}
        onClick={onArchive}
      >
        {item.archived_at ? <ArchiveRestore /> : <Archive />}
      </Button>
      {canDelete && (
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.name}`} title="Delete (never requested)" onClick={onDelete}>
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

function GroupDialog({
  teamId,
  state,
  categories,
  onClose,
  onCreated,
}: {
  teamId: string;
  state: { group: AdminGroup | null } | null;
  categories: AdminCategory[];
  onClose: () => void;
  onCreated: (group: AdminGroup) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [icon, setIcon] = React.useState("");
  const [attrs, setAttrs] = React.useState<string[]>(["Size"]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!state) return;
    const g = state.group;
    setName(g?.name ?? "");
    setCategoryId(g?.category_id ?? categories.find((c) => !c.archived_at)?.id ?? "");
    setDescription(g?.description ?? "");
    setIcon(g?.icon ?? "");
    setAttrs(g?.attribute_names.length ? g.attribute_names : ["Size"]);
    setError(null);
  }, [state, categories]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input = { name, category_id: categoryId, description, icon, attribute_names: attrs.map((a) => a.trim()).filter(Boolean) };
    const res = await saveProductGroup(teamId, state?.group?.id ?? null, input);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(state?.group ? "Group saved" : "Group created — now add its variants");
    onClose();
    router.refresh();
    if (!state?.group && res.id) {
      onCreated({
        id: res.id,
        name: name.trim(),
        description: description || null,
        icon: icon || null,
        category_id: categoryId || null,
        attribute_names: input.attribute_names,
        sort_order: 0,
        archived_at: null,
      });
    }
  };

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{state?.group ? "Edit product group" : "New product group"}</DialogTitle>
            <DialogDescription>One card for technicians. They choose each option in order, then the quantity.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="group-name">
                <Input id="group-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Long Bit" />
              </Field>
              <Field label="Category" htmlFor="group-cat">
                <NativeSelect id="group-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">No category</option>
                  {categories
                    .filter((c) => !c.archived_at || c.id === categoryId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Short description (optional)" htmlFor="group-desc">
              <Input id="group-desc" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Long installer bits" />
            </Field>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Options technicians choose, in order</span>
              {attrs.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-center text-sm text-muted-foreground">{i + 1}</span>
                  <Input
                    value={a}
                    maxLength={30}
                    aria-label={`Option ${i + 1} name`}
                    placeholder={i === 0 ? "e.g. Type" : "e.g. Size"}
                    onChange={(e) => setAttrs((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove option ${i + 1}`}
                    disabled={attrs.length === 1}
                    onClick={() => setAttrs((list) => list.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              {attrs.length < MAX_ATTRIBUTES && (
                <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setAttrs((l) => [...l, ""])}>
                  <Plus /> Add option
                </Button>
              )}
              {state?.group && (
                <p className="text-xs text-muted-foreground">Renaming an option keeps each variant&apos;s value (matched by position).</p>
              )}
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Icon</span>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />} {state?.group ? "Save group" : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VariantDialog({
  teamId,
  state,
  siblings,
  onClose,
}: {
  teamId: string;
  state: { group: AdminGroup; variant: AdminItem | null } | null;
  siblings: AdminItem[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Attributes>({});
  const [unit, setUnit] = React.useState("each");
  const [sku, setSku] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [addAnother, setAddAnother] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = React.useCallback((v: AdminItem | null, keep?: Attributes) => {
    setValues(v?.attributes ?? keep ?? {});
    setUnit(v?.unit ?? "each");
    setSku(v?.grainger_sku ?? "");
    setUrl(v?.grainger_url ?? "");
    setDescription(v?.description ?? "");
    setError(null);
  }, []);

  React.useEffect(() => {
    if (state) reset(state.variant);
  }, [state, reset]);

  if (!state) return <Dialog open={false} />;
  const g = state.group;
  const preview = variantName(g.name, g.attribute_names, values);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await saveVariant(teamId, g.id, state.variant?.id ?? null, {
      attributes: values,
      unit,
      grainger_sku: sku,
      grainger_url: url,
      description,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(state.variant ? "Variant saved" : `Added ${preview}`);
    router.refresh();
    if (addAnother && !state.variant) {
      // Keep earlier choices (e.g. Type), clear the last option for quick entry.
      const keep = { ...values };
      delete keep[g.attribute_names[g.attribute_names.length - 1]];
      reset(null, keep);
    } else onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{state.variant ? "Edit variant" : `Add variant to ${g.name}`}</DialogTitle>
            <DialogDescription>
              Appears on requests and the shopping list as <span className="font-medium text-foreground">{preview}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {g.attribute_names.map((n) => {
                const listId = `opt-${g.id}-${n}`.replace(/[^a-zA-Z0-9-]/g, "");
                const existing = [...new Set(siblings.map((s) => s.attributes[n]).filter(Boolean))];
                return (
                  <Field key={n} label={n} htmlFor={listId + "-input"}>
                    <Input
                      id={listId + "-input"}
                      list={listId}
                      maxLength={40}
                      value={values[n] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [n]: e.target.value }))}
                      placeholder={existing[0] ?? ""}
                    />
                    <datalist id={listId}>
                      {existing.map((x) => (
                        <option key={x} value={x} />
                      ))}
                    </datalist>
                  </Field>
                );
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <Field label="Unit" htmlFor="variant-unit">
                <Input id="variant-unit" maxLength={20} value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
              <Field label="Grainger SKU" htmlFor="variant-sku">
                <Input id="variant-sku" maxLength={40} value={sku} onChange={(e) => setSku(e.target.value)} className="font-mono" />
              </Field>
            </div>
            <Field label="Grainger product URL" htmlFor="variant-url">
              <Input id="variant-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.grainger.com/product/…" />
            </Field>
            <Field label="Note (optional)" htmlFor="variant-desc">
              <Textarea id="variant-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            {!state.variant && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={addAnother} onCheckedChange={setAddAnother} /> Add another after saving
              </label>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner />} {state.variant ? "Save variant" : "Add variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
