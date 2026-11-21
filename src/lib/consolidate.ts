import { customItemKey } from "@/lib/names";

/** One outstanding (requested, not removed) line from a technician's request. */
export type OutstandingItem = {
  id: string;
  request_id: string;
  request_created_at: string;
  technician_id: string;
  technician_name: string;
  catalog_item_id: string | null;
  name: string;
  unit: string | null;
  grainger_sku: string | null;
  grainger_url: string | null;
  quantity: number;
  is_custom: boolean;
  custom_note: string | null;
  custom_url: string | null;
};

export type TechnicianShare = {
  technician_id: string;
  technician_name: string;
  quantity: number;
  itemIds: string[];
};

export type ProductLine = {
  key: string;
  name: string;
  unit: string | null;
  grainger_sku: string | null;
  grainger_url: string | null;
  is_custom: boolean;
  totalQuantity: number;
  technicianCount: number;
  technicians: TechnicianShare[];
  itemIds: string[];
  notes: string[];
  links: string[];
};

export type TechnicianLine = {
  key: string;
  name: string;
  unit: string | null;
  grainger_sku: string | null;
  grainger_url: string | null;
  is_custom: boolean;
  quantity: number;
  itemIds: string[];
  notes: string[];
  links: string[];
};

export type TechnicianGroup = {
  technician_id: string;
  technician_name: string;
  totalQuantity: number;
  requestIds: string[];
  itemIds: string[];
  lines: TechnicianLine[];
};

export function productKey(item: Pick<OutstandingItem, "catalog_item_id" | "name">): string {
  return item.catalog_item_id ? `c:${item.catalog_item_id}` : `x:${customItemKey(item.name)}`;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });

function pushUnique(list: string[], value: string | null) {
  if (value && !list.includes(value)) list.push(value);
}

/** Aggregate outstanding items into one line per product, keeping per-technician quantities. */
export function consolidateByProduct(items: OutstandingItem[]): ProductLine[] {
  const map = new Map<string, ProductLine>();
  for (const item of items) {
    const key = productKey(item);
    let line = map.get(key);
    if (!line) {
      line = {
        key,
        name: item.name,
        unit: item.unit,
        grainger_sku: item.grainger_sku,
        grainger_url: item.grainger_url,
        is_custom: item.is_custom,
        totalQuantity: 0,
        technicianCount: 0,
        technicians: [],
        itemIds: [],
        notes: [],
        links: [],
      };
      map.set(key, line);
    }
    line.totalQuantity += item.quantity;
    line.itemIds.push(item.id);
    line.grainger_sku ??= item.grainger_sku;
    line.grainger_url ??= item.grainger_url;
    pushUnique(line.notes, item.custom_note);
    pushUnique(line.links, item.custom_url);

    let share = line.technicians.find((t) => t.technician_id === item.technician_id);
    if (!share) {
      share = {
        technician_id: item.technician_id,
        technician_name: item.technician_name,
        quantity: 0,
        itemIds: [],
      };
      line.technicians.push(share);
    }
    share.quantity += item.quantity;
    share.itemIds.push(item.id);
  }

  const lines = [...map.values()];
  for (const line of lines) {
    line.technicianCount = line.technicians.length;
    line.technicians.sort((a, b) => a.technician_name.localeCompare(b.technician_name));
  }
  // Catalog products first (alphabetical), then custom items.
  return lines.sort((a, b) => Number(a.is_custom) - Number(b.is_custom) || byName(a, b));
}

/** Group outstanding items per technician, merging duplicate products for each person. */
export function groupByTechnician(items: OutstandingItem[]): TechnicianGroup[] {
  const map = new Map<string, TechnicianGroup>();
  for (const item of items) {
    let group = map.get(item.technician_id);
    if (!group) {
      group = {
        technician_id: item.technician_id,
        technician_name: item.technician_name,
        totalQuantity: 0,
        requestIds: [],
        itemIds: [],
        lines: [],
      };
      map.set(item.technician_id, group);
    }
    group.totalQuantity += item.quantity;
    group.itemIds.push(item.id);
    pushUnique(group.requestIds, item.request_id);

    const key = productKey(item);
    let line = group.lines.find((l) => l.key === key);
    if (!line) {
      line = {
        key,
        name: item.name,
        unit: item.unit,
        grainger_sku: item.grainger_sku,
        grainger_url: item.grainger_url,
        is_custom: item.is_custom,
        quantity: 0,
        itemIds: [],
        notes: [],
        links: [],
      };
      group.lines.push(line);
    }
    line.quantity += item.quantity;
    line.itemIds.push(item.id);
    pushUnique(line.notes, item.custom_note);
    pushUnique(line.links, item.custom_url);
  }
  const groups = [...map.values()];
  for (const g of groups) g.lines.sort((a, b) => Number(a.is_custom) - Number(b.is_custom) || byName(a, b));
  return groups.sort((a, b) => a.technician_name.localeCompare(b.technician_name));
}

function unitSuffix(unit: string | null) {
  return unit && unit !== "each" ? ` ${unit}` : "";
}

export function productListToText(lines: ProductLine[]): string {
  return lines
    .map((l) => {
      const sku = l.grainger_sku ? ` [SKU ${l.grainger_sku}]` : l.is_custom ? " [not in catalog]" : "";
      const who = l.technicians.map((t) => `${t.technician_name} ${t.quantity}`).join(", ");
      return `${l.totalQuantity}${unitSuffix(l.unit)} × ${l.name}${sku} — ${who}`;
    })
    .join("\n");
}

export function technicianListToText(groups: TechnicianGroup[]): string {
  return groups
    .map((g) => {
      const lines = g.lines
        .map((l) => {
          const sku = l.grainger_sku ? ` [SKU ${l.grainger_sku}]` : "";
          return `  - ${l.quantity}${unitSuffix(l.unit)} × ${l.name}${sku}`;
        })
        .join("\n");
      return `${g.technician_name}\n${lines}`;
    })
    .join("\n\n");
}

/** "SKU,quantity" lines for Grainger's quick order / bulk paste. Lines without a SKU are returned separately. */
export function graingerQuickOrder(lines: ProductLine[]): { text: string; missing: ProductLine[] } {
  const withSku = lines.filter((l) => l.grainger_sku);
  return {
    text: withSku.map((l) => `${l.grainger_sku},${l.totalQuantity}`).join("\n"),
    missing: lines.filter((l) => !l.grainger_sku),
  };
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  // Neutralize spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function productListToCsv(lines: ProductLine[]): string {
  return toCsv([
    ["Product", "Grainger SKU", "Unit", "Total quantity", "Technicians", "Breakdown", "Grainger URL", "Custom item"],
    ...lines.map((l) => [
      l.name,
      l.grainger_sku,
      l.unit,
      l.totalQuantity,
      l.technicianCount,
      l.technicians.map((t) => `${t.technician_name}: ${t.quantity}`).join("; "),
      l.grainger_url ?? l.links[0] ?? "",
      l.is_custom ? "yes" : "",
    ]),
  ]);
}

export function technicianListToCsv(groups: TechnicianGroup[]): string {
  return toCsv([
    ["Technician", "Product", "Grainger SKU", "Unit", "Quantity", "Grainger URL"],
    ...groups.flatMap((g) =>
      g.lines.map((l) => [g.technician_name, l.name, l.grainger_sku, l.unit, l.quantity, l.grainger_url ?? l.links[0] ?? ""]),
    ),
  ]);
}
