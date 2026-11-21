"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileUp,
  ImagePlus,
  Pencil,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  createCategory,
  importCatalog,
  reorderCategories,
  saveCatalogItem,
  updateCategory,
  uploadCatalogImage,
} from "@/lib/actions/catalog";
import { CATALOG_CSV_TEMPLATE, catalogToCsv, parseCatalogCsv, type CatalogImportResult } from "@/lib/csv";
import { IconPicker, ProductsTab, type AdminGroup, type AdminItem } from "@/components/admin/catalog-products";
import type { CustomItemSummary } from "@/lib/data/admin";
import { cn, plural, safeHttpUrl, timeAgo } from "@/lib/utils";

type Category = { id: string; name: string; sort_order: number; archived_at: string | null };
type Item = AdminItem;
type Tab = "items" | "categories" | "custom" | "import";

type Draft = {
  id: string | null;
  name: string;
  category_id: string;
  description: string;
  unit: string;
  grainger_sku: string;
  grainger_url: string;
  image_url: string;
  icon: string;
  linkCustomItemIds?: string[];
};

const emptyDraft = (): Draft => ({
  id: null,
  name: "",
  category_id: "",
  description: "",
  unit: "each",
  grainger_sku: "",
  grainger_url: "",
  image_url: "",
  icon: "",
});

export function CatalogManager({
  teamId,
  categories,
  items,
  groups,
  requestedIds,
  custom,
  initialTab,
}: {
  teamId: string;
  categories: Category[];
  items: Item[];
  groups: AdminGroup[];
  requestedIds: string[];
  custom: CustomItemSummary[];
  initialTab: Tab;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTabState] = React.useState<Tab>(initialTab);
  const [draft, setDraft] = React.useState<Draft | null>(null);

  const setTab = (t: Tab) => {
    setTabState(t);
    router.replace(t === "items" ? pathname : `${pathname}?tab=${t}`, { scroll: false });
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    {
      id: "items",
      label: "Products",
      count: groups.filter((g) => !g.archived_at).length + items.filter((i) => !i.archived_at && !i.group_id).length,
    },
    { id: "categories", label: "Categories", count: categories.filter((c) => !c.archived_at).length },
    { id: "custom", label: "Other requests", count: custom.length },
    { id: "import", label: "CSV import" },
  ];

  return (
    <div className="grid gap-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="inline-flex rounded-lg border bg-card p-0.5" role="tablist" aria-label="Catalog sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium",
                tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-xs tabular-nums", tab === t.id ? "bg-white/20" : "bg-muted")}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "items" && (
        <ProductsTab
          teamId={teamId}
          categories={categories}
          groups={groups}
          items={items}
          requestedIds={requestedIds}
          onAddItem={() => setDraft(emptyDraft())}
          onEditItem={(item) =>
            setDraft({
              id: item.id,
              name: item.name,
              category_id: item.category_id ?? "",
              description: item.description ?? "",
              unit: item.unit ?? "",
              grainger_sku: item.grainger_sku ?? "",
              grainger_url: item.grainger_url ?? "",
              image_url: item.image_url ?? "",
              icon: item.icon ?? "",
            })
          }
        />
      )}
      {tab === "categories" && <CategoriesTab teamId={teamId} categories={categories} items={items} />}
      {tab === "custom" && (
        <CustomTab
          custom={custom}
          onConvert={(c) =>
            setDraft({
              ...emptyDraft(),
              name: c.name,
              grainger_url: c.links.find((l) => /grainger\.com/i.test(l)) ?? "",
              linkCustomItemIds: c.itemIds,
            })
          }
        />
      )}
      {tab === "import" && (
        <ImportTab
          teamId={teamId}
          onDone={() => setTab("items")}
          exportCsv={() =>
            catalogToCsv(
              items
                .filter((i) => !i.archived_at)
                .map((i) => {
                  const g = i.group_id ? groups.find((x) => x.id === i.group_id) : null;
                  return {
                    id: i.id,
                    name: i.name,
                    category: categories.find((c) => c.id === (g ? g.category_id : i.category_id))?.name ?? null,
                    group: g?.name ?? null,
                    attribute_names: g?.attribute_names ?? [],
                    attributes: i.attributes,
                    icon: g ? g.icon : i.icon,
                    unit: i.unit,
                    description: i.description,
                    grainger_sku: i.grainger_sku,
                    grainger_url: i.grainger_url,
                    image_url: i.image_url,
                  };
                }),
            )
          }
        />
      )}

      <ItemDialog teamId={teamId} draft={draft} categories={categories} onClose={() => setDraft(null)} />
    </div>
  );
}

const UNIT_SUGGESTIONS = ["each", "pack", "box", "bag", "roll", "set", "kit", "tube", "pair", "case", "ft"];

function ItemDialog({
  teamId,
  draft,
  categories,
  onClose,
}: {
  teamId: string;
  draft: Draft | null;
  categories: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [d, setD] = React.useState<Draft>(emptyDraft());
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (draft) {
      setD(draft);
      setError(null);
    }
  }, [draft]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD((x) => ({ ...x, [k]: e.target.value }));

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadCatalogImage(teamId, fd);
    setUploading(false);
    if (!res.ok || !res.url) return void toast.error(res.ok ? "Upload failed." : res.error);
    setD((x) => ({ ...x, image_url: res.url! }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { id, linkCustomItemIds, ...input } = d;
    const res = await saveCatalogItem(teamId, id, input, linkCustomItemIds);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    toast.success(id ? "Item saved" : linkCustomItemIds?.length ? `Added to catalog and linked ${plural(linkCustomItemIds.length, "request")}` : "Item added");
    onClose();
    router.refresh();
  };

  const img = safeHttpUrl(d.image_url);

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{d.id ? "Edit item" : d.linkCustomItemIds ? "Add requested item to catalog" : "Add item"}</DialogTitle>
            {d.linkCustomItemIds && (
              <DialogDescription>
                {plural(d.linkCustomItemIds.length, "past request")} for this item will be linked to the new product.
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogBody className="grid gap-4 pb-4">
            <Field label="Product name" htmlFor="item-name">
              <Input id="item-name" required maxLength={120} value={d.name} onChange={set("name")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="item-cat">
                <NativeSelect id="item-cat" value={d.category_id} onChange={set("category_id")}>
                  <option value="">No category</option>
                  {categories
                    .filter((c) => !c.archived_at || c.id === d.category_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </NativeSelect>
              </Field>
              <Field label="Unit" htmlFor="item-unit" hint="each, pack, box, roll…">
                <Input id="item-unit" list="unit-suggestions" maxLength={20} value={d.unit} onChange={set("unit")} />
                <datalist id="unit-suggestions">
                  {UNIT_SUGGESTIONS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </Field>
            </div>
            <Field label="Description (optional)" htmlFor="item-desc">
              <Textarea id="item-desc" rows={2} maxLength={500} value={d.description} onChange={set("description")} placeholder="Size, pack count, when to use it" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <Field label="Grainger SKU" htmlFor="item-sku">
                <Input id="item-sku" maxLength={40} value={d.grainger_sku} onChange={set("grainger_sku")} className="font-mono" />
              </Field>
              <Field label="Grainger product URL" htmlFor="item-url">
                <Input id="item-url" type="url" value={d.grainger_url} onChange={set("grainger_url")} placeholder="https://www.grainger.com/product/…" />
              </Field>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Icon</span>
              <IconPicker value={d.icon} onChange={(icon) => setD((x) => ({ ...x, icon }))} />
            </div>
            <Field label="Photo (optional, replaces the icon)" htmlFor="item-img">
              <div className="flex items-center gap-3">
                {img ? (
                  <img src={img} alt="" className="size-14 shrink-0 rounded-lg border object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                    <ImagePlus className="size-5" aria-hidden />
                  </span>
                )}
                <div className="grid flex-1 gap-2">
                  <Input id="item-img" type="url" value={d.image_url} onChange={set("image_url")} placeholder="Paste an image URL, or upload" />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? <Spinner /> : <FileUp />} Upload image
                    </Button>
                    {d.image_url && (
                      <Button variant="ghost" size="sm" onClick={() => setD((x) => ({ ...x, image_url: "" }))}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </Field>
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
            <Button type="submit" disabled={saving || uploading}>
              {saving && <Spinner />} {d.id ? "Save changes" : "Add to catalog"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesTab({ teamId, categories, items }: { teamId: string; categories: Category[]; items: Item[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const counts = new Map<string, number>();
  for (const i of items) if (i.category_id && !i.archived_at) counts.set(i.category_id, (counts.get(i.category_id) ?? 0) + 1);

  const run = async (p: Promise<{ ok: boolean; error?: string }>, msg?: string) => {
    setBusy(true);
    const res = await p;
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Something went wrong"), false;
    if (msg) toast.success(msg);
    router.refresh();
    return true;
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = categories.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(reorderCategories(teamId, ids));
  };

  return (
    <div className="grid max-w-2xl gap-4">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(createCategory(teamId, name), "Category added")) setName("");
        }}
      >
        <Input placeholder="New category name" aria-label="New category name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!name.trim() || busy}>
          <Plus /> Add
        </Button>
      </form>
      {categories.length === 0 ? (
        <EmptyState title="No categories yet" description="Categories group items on the technician page, in the order you set here." />
      ) : (
        <ul className={cn("divide-y overflow-hidden rounded-xl border bg-card", busy && "opacity-60")}>
          {categories.map((c, index) => (
            <li key={c.id} className={cn("flex items-center gap-2 px-3 py-2", c.archived_at && "opacity-60")}>
              <div className="flex flex-col">
                <button type="button" className="rounded p-0.5 hover:bg-muted disabled:opacity-30" onClick={() => move(index, -1)} disabled={index === 0 || busy} aria-label={`Move ${c.name} up`}>
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                  onClick={() => move(index, 1)}
                  disabled={index === categories.length - 1 || busy}
                  aria-label={`Move ${c.name} down`}
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              {editing?.id === c.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run(updateCategory(teamId, c.id, { name: editing.name }), "Renamed")) setEditing(null);
                  }}
                >
                  <Input autoFocus value={editing.name} maxLength={60} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} className="h-8" aria-label="Category name" />
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-medium">
                    {c.name} {c.archived_at && <Badge variant="outline">Archived</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">{plural(counts.get(c.id) ?? 0, "item")}</span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Rename ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name })}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={c.archived_at ? `Restore ${c.name}` : `Archive ${c.name}`}
                    title={c.archived_at ? "Restore" : "Archive (items move to “Other supplies” for technicians)"}
                    onClick={() => run(updateCategory(teamId, c.id, { archived: !c.archived_at }), c.archived_at ? "Category restored" : "Category archived")}
                  >
                    {c.archived_at ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomTab({ custom, onConvert }: { custom: CustomItemSummary[]; onConvert: (c: CustomItemSummary) => void }) {
  if (custom.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles />}
        title="No “other” requests to review"
        description="When technicians request items that aren't in the catalog, they're grouped here so you can add popular ones as products."
      />
    );
  }
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {custom.map((c) => (
        <li key={c.key} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.name}</span>
              <Badge variant={c.requestCount > 1 ? "primary" : "outline"}>{plural(c.requestCount, "request")}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {c.totalQuantity} total · {c.technicians.join(", ")} · last {timeAgo(c.lastRequested)}
            </p>
            {c.notes.length > 0 && <p className="mt-1 text-xs italic text-muted-foreground">“{c.notes.join("” · “")}”</p>}
            {c.links.map((l) =>
              safeHttpUrl(l) ? (
                <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="mr-3 inline-flex items-center gap-0.5 text-xs text-primary hover:underline">
                  {new URL(l).hostname} <ExternalLink className="size-3" />
                </a>
              ) : null,
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => onConvert(c)}>
            <Plus /> Add to catalog
          </Button>
        </li>
      ))}
    </ul>
  );
}

function ImportTab({ teamId, onDone, exportCsv }: { teamId: string; onDone: () => void; exportCsv: () => string }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<CatalogImportResult | null>(null);
  const [importing, setImporting] = React.useState(false);

  React.useEffect(() => {
    setResult(text.trim() ? parseCatalogCsv(text) : null);
  }, [text]);

  const doImport = async () => {
    if (!result?.rows.length) return;
    setImporting(true);
    const res = await importCatalog(teamId, result.rows);
    setImporting(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Imported: ${res.created} added, ${res.updated} updated${res.skipped ? `, ${res.skipped} skipped` : ""}`);
    if (res.problems?.length) toast.warning(res.problems.slice(0, 5).join("\n"), { duration: 12000 });
    setText("");
    router.refresh();
    onDone();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex">
            <span className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium hover:bg-muted")}>
              <FileUp className="size-4" /> Choose CSV file
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 1024 * 1024) return void toast.error("CSV must be under 1 MB.");
                setText(await f.text());
                e.target.value = "";
              }}
            />
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([CATALOG_CSV_TEMPLATE], { type: "text/csv" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = "catalog-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Download template
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const url = URL.createObjectURL(new Blob(["\uFEFF" + exportCsv()], { type: "text/csv;charset=utf-8" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = `catalog-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export current catalog
          </Button>
        </div>
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"…or paste CSV here\n\nname,category,unit,description,grainger_sku,grainger_url,image_url"}
          className="font-mono text-xs"
          aria-label="CSV contents"
        />
        {result && (
          <div className="rounded-xl border bg-card p-3 text-sm">
            <p>
              <span className="font-medium">{plural(result.rows.length, "row")}</span> ready to import
              {result.errors.length > 0 && <span className="text-destructive"> · {plural(result.errors.length, "problem")}</span>}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-destructive">
                {result.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            {result.rows.length > 0 && (
              <div className="mt-3 max-h-64 overflow-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {["Name", "Category", "Group / options", "SKU"].map((h) => (
                        <th key={h} className="px-2 py-1.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.rows.slice(0, 100).map((r) => (
                      <tr key={r.line}>
                        <td className="px-2 py-1">{r.name}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.category ?? "—"}</td>
                        <td className="px-2 py-1 text-muted-foreground">
                          {r.group ? `${r.group}: ${r.attribute_names.map((n) => r.attributes[n]).join(" · ")}` : "—"}
                        </td>
                        <td className="px-2 py-1 font-mono text-muted-foreground">{r.grainger_sku ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button className="mt-3" onClick={doImport} disabled={importing || result.rows.length === 0}>
              {importing && <Spinner />} Import {plural(result.rows.length, "item")}
            </Button>
          </div>
        )}
      </div>
      <aside className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">How import works</p>
        <ul className="list-disc space-y-1.5 pl-4">
          <li>
            Only <code className="text-foreground">name</code> is required. Other columns: category, unit, description, grainger_sku, grainger_url, image_url.
          </li>
          <li>Rows matching an existing item (same SKU, or same name) update it. Everything else is added.</li>
          <li>New categories are created automatically.</li>
          <li>Up to 1,000 rows per import.</li>
        </ul>
      </aside>
    </div>
  );
}
