import { describe, expect, it } from "vitest";
import {
  consolidateByProduct,
  graingerQuickOrder,
  groupByTechnician,
  productListToCsv,
  productListToText,
  toCsv,
  type OutstandingItem,
} from "@/lib/consolidate";

let n = 0;
function item(p: Partial<OutstandingItem>): OutstandingItem {
  n++;
  return {
    id: `i${n}`,
    request_id: "r1",
    request_created_at: "2026-11-01T00:00:00Z",
    technician_id: "t1",
    technician_name: "Mike",
    catalog_item_id: "drill",
    name: "Drill bit 1/4",
    unit: "each",
    grainger_sku: "1ABC2",
    grainger_url: "https://www.grainger.com/x",
    quantity: 1,
    is_custom: false,
    custom_note: null,
    custom_url: null,
    ...p,
  };
}

describe("consolidateByProduct", () => {
  it("sums quantities across technicians and keeps per-technician breakdown", () => {
    const lines = consolidateByProduct([
      item({ technician_id: "t1", technician_name: "Mike", quantity: 2 }),
      item({ technician_id: "t2", technician_name: "Sarah", quantity: 3, request_id: "r2" }),
      item({ technician_id: "t1", technician_name: "Mike", quantity: 1, request_id: "r3" }),
      item({ catalog_item_id: "tape", name: "Electrical tape", quantity: 4, grainger_sku: null }),
    ]);
    expect(lines).toHaveLength(2);
    const drill = lines.find((l) => l.name === "Drill bit 1/4")!;
    expect(drill.totalQuantity).toBe(6);
    expect(drill.technicianCount).toBe(2);
    expect(drill.technicians).toEqual([
      expect.objectContaining({ technician_name: "Mike", quantity: 3 }),
      expect.objectContaining({ technician_name: "Sarah", quantity: 3 }),
    ]);
    expect(drill.itemIds).toHaveLength(3);
    expect(drill.grainger_sku).toBe("1ABC2");
  });

  it("groups custom items by normalized name and sorts them after catalog items", () => {
    const lines = consolidateByProduct([
      item({ catalog_item_id: null, is_custom: true, name: "Right-angle drill attachment", custom_note: "tight bays", grainger_sku: null }),
      item({ catalog_item_id: null, is_custom: true, name: "right angle  drill attachment", technician_id: "t2", technician_name: "Sarah", grainger_sku: null }),
      item({ name: "Anchors", catalog_item_id: "anchors" }),
    ]);
    expect(lines.map((l) => l.name)).toEqual(["Anchors", "Right-angle drill attachment"]);
    expect(lines[1].totalQuantity).toBe(2);
    expect(lines[1].notes).toEqual(["tight bays"]);
  });

  it("returns an empty list for no items", () => {
    expect(consolidateByProduct([])).toEqual([]);
  });
});

describe("groupByTechnician", () => {
  it("merges the same product across a technician's requests", () => {
    const groups = groupByTechnician([
      item({ request_id: "r1", quantity: 2 }),
      item({ request_id: "r2", quantity: 1 }),
      item({ technician_id: "t2", technician_name: "Ann", catalog_item_id: "tape", name: "Tape" }),
    ]);
    expect(groups.map((g) => g.technician_name)).toEqual(["Ann", "Mike"]);
    const mike = groups[1];
    expect(mike.lines).toHaveLength(1);
    expect(mike.lines[0].quantity).toBe(3);
    expect(mike.requestIds).toEqual(["r1", "r2"]);
    expect(mike.itemIds).toHaveLength(2);
  });
});

describe("exports", () => {
  const lines = consolidateByProduct([
    item({ quantity: 2 }),
    item({ catalog_item_id: null, is_custom: true, name: "Ladder hooks", grainger_sku: null, grainger_url: null }),
  ]);

  it("builds a Grainger quick-order list and reports items without SKUs", () => {
    const { text, missing } = graingerQuickOrder(lines);
    expect(text).toBe("1ABC2,2");
    expect(missing.map((m) => m.name)).toEqual(["Ladder hooks"]);
  });

  it("renders readable text", () => {
    expect(productListToText(lines)).toContain("2 × Drill bit 1/4 [SKU 1ABC2] — Mike 2");
  });

  it("escapes CSV and neutralizes formula injection", () => {
    expect(toCsv([["a,b", 'say "hi"', "=SUM(A1)", 3]])).toBe(`"a,b","say ""hi""",'=SUM(A1),3`);
    expect(productListToCsv(lines).split("\r\n")[0]).toContain("Total quantity");
  });
});
