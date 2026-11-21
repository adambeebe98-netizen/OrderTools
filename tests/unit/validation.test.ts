import { describe, expect, it } from "vitest";
import { submitRequestSchema, catalogItemSchema } from "@/lib/validation";
import { cleanName, customItemKey, makeTeamSlug, nameKey } from "@/lib/names";
import { parseCatalogCsv } from "@/lib/csv";
import { formatQty, safeHttpUrl } from "@/lib/utils";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("names", () => {
  it("normalizes technician names the same way as SQL", () => {
    expect(cleanName("  Mike   Torres ")).toBe("Mike Torres");
    expect(nameKey("  MIKE   torres ")).toBe("mike torres");
  });
  it("groups custom item spellings", () => {
    expect(customItemKey("Right-angle  Drill!")).toBe(customItemKey("right angle drill"));
  });
  it("makes valid team slugs", () => {
    expect(makeTeamSlug("North Install Team!")).toMatch(/^north-install-team-[a-z0-9]{6}$/);
    expect(makeTeamSlug("!!!")).toMatch(/^team-[a-z0-9]{6}$/);
  });
});

describe("submitRequestSchema", () => {
  it("accepts catalog and custom lines", () => {
    const r = submitRequestSchema.safeParse({
      name: "  Dana  ",
      items: [
        { catalog_item_id: uuid, quantity: "2" },
        { custom_name: "Hooks", quantity: 1, custom_note: "", custom_url: "" },
      ],
      note: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("Dana");
      expect(r.data.items[0].quantity).toBe(2);
      expect(r.data.note).toBeNull();
    }
  });

  it.each([
    [{ name: "", items: [{ catalog_item_id: uuid, quantity: 1 }] }],
    [{ name: "A", items: [] }],
    [{ name: "A", items: [{ catalog_item_id: uuid, quantity: 0 }] }],
    [{ name: "A", items: [{ catalog_item_id: uuid, quantity: 1000 }] }],
    [{ name: "A", items: [{ catalog_item_id: "nope", quantity: 1 }] }],
    [{ name: "A", items: [{ custom_name: "x", quantity: 1, custom_url: "javascript:alert(1)" }] }],
    [{ name: "A".repeat(61), items: [{ catalog_item_id: uuid, quantity: 1 }] }],
    [{ name: "A", items: Array.from({ length: 51 }, () => ({ catalog_item_id: uuid, quantity: 1 })) }],
  ])("rejects invalid input %#", (input) => {
    expect(submitRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe("catalogItemSchema", () => {
  it("rejects non-http URLs", () => {
    expect(catalogItemSchema.safeParse({ name: "x", grainger_url: "ftp://a" }).success).toBe(false);
    expect(catalogItemSchema.safeParse({ name: "x", image_url: "data:image/png;base64,AAAA" }).success).toBe(false);
  });
});

describe("parseCatalogCsv", () => {
  it("maps header aliases and reports bad rows", () => {
    const csv = [
      "Product,Category,UOM,SKU,Link",
      '"Masonry bit 1/4"" x 6""",Drill Bits,each,1ABC2,https://www.grainger.com/p',
      ",Drill Bits,each,,",
      "Tape,Electrical,roll,,not-a-url",
    ].join("\n");
    const { rows, errors } = parseCatalogCsv(csv);
    expect(rows).toEqual([
      expect.objectContaining({ line: 2, name: 'Masonry bit 1/4" x 6"', category: "Drill Bits", unit: "each", grainger_sku: "1ABC2" }),
    ]);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
  });
  it("requires a name column", () => {
    expect(parseCatalogCsv("sku\n123").errors[0].message).toMatch(/name/);
  });
});

describe("utils", () => {
  it("formats quantities with units", () => {
    expect(formatQty(1, "each")).toBe("1");
    expect(formatQty(2, "box")).toBe("2 boxes");
    expect(formatQty(1, "roll")).toBe("1 roll");
  });
  it("only allows http(s) links", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("https://grainger.com")).toBe("https://grainger.com/");
  });
});

describe("optional fields", () => {
  it("accepts custom lines without optional keys", () => {
    expect(submitRequestSchema.safeParse({ name: "x", items: [{ custom_name: "a", quantity: 1 }] }).success).toBe(true);
  });
});
