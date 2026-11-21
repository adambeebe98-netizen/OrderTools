import Papa from "papaparse";
import { catalogItemSchema } from "@/lib/validation";

export type CatalogImportRow = {
  line: number;
  name: string;
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

const HEADER_ALIASES: Record<string, keyof Omit<CatalogImportRow, "line">> = {
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
  "name,category,unit,description,grainger_sku,grainger_url,image_url\n" +
  '"Masonry Drill Bit 1/4"" x 6""",Drill Bits,each,Carbide tip,,https://www.grainger.com/,\n';

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
  if (!fields.some((f) => HEADER_ALIASES[f] === "name")) {
    return { rows, errors: [{ line: 1, message: 'CSV needs a "name" column' }] };
  }

  parsed.data.slice(0, MAX_IMPORT_ROWS).forEach((raw, index) => {
    const line = index + 2; // header is line 1
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      const target = HEADER_ALIASES[key];
      if (target && typeof value === "string" && value.trim()) mapped[target] = value.trim();
    }
    const result = catalogItemSchema.safeParse({
      name: mapped.name ?? "",
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
      name: result.data.name,
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
