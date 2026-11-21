import Papa from "papaparse";
import { catalogItemSchema } from "@/lib/validation";
import { formatAttributeString, parseAttributeString, type Attributes } from "@/lib/variants";
import { toCsv } from "@/lib/consolidate";

export type CatalogImportRow = {
  line: number;
  id: string | null;
  name: string;
  group: string | null;
  attributes: Attributes;
  attribute_names: string[];
  icon: string | null;
  category: string | null;
  unit: string | null;
  description: string | null;
  grainger_sku: string | null;
  grainger_url: string | null;
  image_url: string | null;
};

export type CatalogImportResult = {
  rows: CatalogImportRow[];
  errors: { line: number; message: string }[];
};

type ImportField = "id" | "name" | "category" | "group" | "options" | "icon" | "unit" | "description" | "grainger_sku" | "grainger_url" | "image_url";

const HEADER_ALIASES: Record<string, ImportField> = {
  id: "id",
  group: "group",
  "product group": "group",
  product_group: "group",
  options: "options",
  attributes: "options",
  variant: "options",
  icon: "icon",
  name: "name",
  product: "name",
  "product name": "name",
  item: "name",
  category: "category",
  unit: "unit",
  uom: "unit",
  description: "description",
  sku: "grainger_sku",
  "grainger sku": "grainger_sku",
  grainger_sku: "grainger_sku",
  "item #": "grainger_sku",
  url: "grainger_url",
  link: "grainger_url",
  "grainger url": "grainger_url",
  grainger_url: "grainger_url",
  "product url": "grainger_url",
  image: "image_url",
  "image url": "image_url",
  image_url: "image_url",
};

export const CATALOG_CSV_TEMPLATE =
  "name,category,group,options,icon,unit,description,grainger_sku,grainger_url,image_url\n" +
  ',Drill Bits,Long Bit,"Type: Masonry | Size: 3/8""",drill-bit,each,Carbide tip,,https://www.grainger.com/,\n' +
  "Zip Ties,Wiring & Connectors,,,zip-tie,bag,,,,\n";

export const MAX_IMPORT_ROWS = 1000;

export function parseCatalogCsv(text: string): CatalogImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: CatalogImportResult["errors"] = [];
  const rows: CatalogImportRow[] = [];

  const fields = parsed.meta.fields ?? [];
  if (!fields.some((f) => HEADER_ALIASES[f] === "name" || HEADER_ALIASES[f] === "group")) {
    return { rows, errors: [{ line: 1, message: 'CSV needs a "name" (or "group") column' }] };
  }

  parsed.data.slice(0, MAX_IMPORT_ROWS).forEach((raw, index) => {
    const line = index + 2; // header is line 1
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const target = HEADER_ALIASES[key];
      if (target && typeof value === "string" && value.trim()) mapped[target] = value.trim();
    }
    const opts = parseAttributeString(mapped.options);
    const group = mapped.group ? mapped.group.slice(0, 80) : null;
    if (group && opts.names.length === 0) {
      errors.push({ line, message: `options: products in group "${group}" need options, e.g. "Size: 3/8\""` });
      return;
    }
    const result = catalogItemSchema.safeParse({
      // Variant names are generated from the group + options, so a name is optional for them.
      name: mapped.name ?? (group ? [group, ...opts.names.map((n) => opts.attributes[n])].join(" — ") : ""),
      icon: mapped.icon,
      description: mapped.description,
      unit: mapped.unit,
      grainger_sku: mapped.grainger_sku,
      grainger_url: mapped.grainger_url,
      image_url: mapped.image_url,
    });
    if (!result.success) {
      const issue = result.error.issues[0];
      errors.push({ line, message: `${issue.path.join(".") || "row"}: ${issue.message}` });
      return;
    }
    const category = mapped.category ? mapped.category.slice(0, 60) : null;
    rows.push({
      line,
      id: mapped.id && /^[0-9a-f-]{36}$/i.test(mapped.id) ? mapped.id : null,
      name: result.data.name,
      group,
      attributes: opts.attributes,
      attribute_names: opts.names,
      icon: result.data.icon,
      category,
      unit: result.data.unit,
      description: result.data.description,
      grainger_sku: result.data.grainger_sku,
      grainger_url: result.data.grainger_url,
      image_url: result.data.image_url,
    });
  });

  if (parsed.data.length > MAX_IMPORT_ROWS) {
    errors.push({ line: MAX_IMPORT_ROWS + 2, message: `Only the first ${MAX_IMPORT_ROWS} rows were read` });
  }
  return { rows, errors };
}

export type CatalogExportItem = {
  id: string;
  name: string;
  category: string | null;
  group: string | null;
  attribute_names: string[];
  attributes: Attributes;
  icon: string | null;
  unit: string | null;
  description: string | null;
  grainger_sku: string | null;
  grainger_url: string | null;
  image_url: string | null;
};

/** Export in the same format the importer reads; the id column lets a re-import update in place. */
export function catalogToCsv(items: CatalogExportItem[]): string {
  return toCsv([
    ["id", "name", "category", "group", "options", "icon", "unit", "description", "grainger_sku", "grainger_url", "image_url"],
    ...items.map((i) => [
      i.id,
      i.name,
      i.category,
      i.group,
      formatAttributeString(i.attribute_names, i.attributes),
      i.icon,
      i.unit,
      i.description,
      i.grainger_sku,
      i.grainger_url,
      i.image_url,
    ]),
  ]);
}
