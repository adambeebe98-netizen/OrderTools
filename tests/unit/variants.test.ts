import { describe, expect, it } from "vitest";
import {
  cleanAttributes,
  formatAttributeString,
  groupSummary,
  optionsFor,
  parseAttributeString,
  resolveSelection,
  sameAttributes,
  variantName,
} from "@/lib/variants";
import { catalogToCsv, parseCatalogCsv } from "@/lib/csv";

const attrs = ["Type", "Size"];
const longBit = [
  { id: "w18", attributes: { Type: "Wood", Size: '1/8"' }, sort_order: 0 },
  { id: "w14", attributes: { Type: "Wood", Size: '1/4"' }, sort_order: 1 },
  { id: "w38", attributes: { Type: "Wood", Size: '3/8"' }, sort_order: 2 },
  { id: "w12", attributes: { Type: "Wood", Size: '1/2"' }, sort_order: 3 },
  { id: "m14", attributes: { Type: "Masonry", Size: '1/4"' }, sort_order: 4 },
  { id: "m38", attributes: { Type: "Masonry", Size: '3/8"' }, sort_order: 5 },
  { id: "m12", attributes: { Type: "Masonry", Size: '1/2"' }, sort_order: 6 },
];
const shortBit = [
  { id: "sw38", attributes: { Type: "Wood", Size: '3/8"' }, sort_order: 0 },
  { id: "sm14", attributes: { Type: "Masonry", Size: '1/4"' }, sort_order: 1 },
];

describe("variant picker logic", () => {
  it("offers only sizes that exist for the chosen type, in display order", () => {
    expect(optionsFor(longBit, attrs, {}, 0)).toEqual(["Wood", "Masonry"]);
    expect(optionsFor(longBit, attrs, { Type: "Masonry" }, 1)).toEqual(['1/4"', '3/8"', '1/2"']);
    expect(optionsFor(longBit, attrs, { Type: "Wood" }, 1)).toEqual(['1/8"', '1/4"', '3/8"', '1/2"']);
  });

  it("resolves the exact variant once every option is picked", () => {
    expect(resolveSelection(longBit, attrs, {}).variant).toBeNull();
    expect(resolveSelection(longBit, attrs, { Type: "Masonry" }).variant).toBeNull();
    expect(resolveSelection(longBit, attrs, { Type: "Masonry", Size: '3/8"' }).variant?.id).toBe("m38");
  });

  it("auto-selects options that have a single choice", () => {
    const r = resolveSelection(shortBit, attrs, { Type: "Wood" });
    expect(r.selection).toEqual({ Type: "Wood", Size: '3/8"' });
    expect(r.variant?.id).toBe("sw38");
    const extraLong = [
      { id: "x38", attributes: { Type: "Masonry", Size: '3/8"' } },
      { id: "x12", attributes: { Type: "Masonry", Size: '1/2"' } },
    ];
    const x = resolveSelection(extraLong, attrs, {});
    expect(x.steps[0]).toEqual({ name: "Type", options: ["Masonry"], value: "Masonry" });
    expect(x.variant).toBeNull();
    const holeSaw = [{ id: "hs", attributes: { Size: '3/4"' } }];
    expect(resolveSelection(holeSaw, ["Size"], {}).variant?.id).toBe("hs");
  });

  it("drops a size that doesn't exist after switching type, keeps one that does", () => {
    expect(resolveSelection(longBit, attrs, { Type: "Masonry", Size: '1/8"' }).selection).toEqual({ Type: "Masonry" });
    expect(resolveSelection(longBit, attrs, { Type: "Masonry", Size: '1/2"' }).variant?.id).toBe("m12");
  });

  it("supports any attribute names (not just type/size)", () => {
    const zip = [
      { id: "b8", attributes: { Length: '8"', Color: "Black" } },
      { id: "w8", attributes: { Length: '8"', Color: "White" } },
      { id: "b11", attributes: { Length: '11"', Color: "Black" } },
    ];
    expect(optionsFor(zip, ["Length", "Color"], { Length: '11"' }, 1)).toEqual(["Black"]);
    expect(resolveSelection(zip, ["Length", "Color"], { Length: '11"' }).variant?.id).toBe("b11");
  });

  it("summarizes groups for cards", () => {
    expect(groupSummary(longBit, attrs)).toBe("Wood · Masonry");
    expect(groupSummary([{ id: "a", attributes: { Type: "Masonry", Size: '3/8"' } }, { id: "b", attributes: { Type: "Masonry", Size: '1/2"' } }], attrs)).toBe(
      "Masonry · 2 sizes",
    );
    expect(groupSummary([{ id: "hs", attributes: { Size: '3/4"' } }], ["Size"])).toBe('3/4"');
  });
});

describe("names and attribute strings", () => {
  it("derives an unambiguous variant name", () => {
    expect(variantName("Long Bit", attrs, { Size: '3/8"', Type: "Masonry" })).toBe('Long Bit — Masonry — 3/8"');
    expect(variantName("Hole Saw", ["Size"], { Size: '3/4"' })).toBe('Hole Saw — 3/4"');
  });
  it("cleans and compares attributes", () => {
    expect(cleanAttributes(attrs, { Type: " Wood ", Size: "", Extra: "x" })).toEqual({ Type: "Wood" });
    expect(sameAttributes({ a: "1", b: "2" }, { b: "2", a: "1" })).toBe(true);
    expect(sameAttributes({ a: "1" }, { a: "1", b: "2" })).toBe(false);
  });
  it("parses and formats the CSV options column", () => {
    const p = parseAttributeString('Type: Masonry | Size: 3/8"');
    expect(p).toEqual({ names: ["Type", "Size"], attributes: { Type: "Masonry", Size: '3/8"' } });
    expect(formatAttributeString(p.names, p.attributes)).toBe('Type: Masonry | Size: 3/8"');
    expect(parseAttributeString("junk | : x | Size:")).toEqual({ names: [], attributes: {} });
  });
});

describe("catalog CSV with groups", () => {
  it("round-trips export → import, keeping ids and options", () => {
    const csv = catalogToCsv([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: 'Long Bit — Masonry — 3/8"',
        category: "Drill Bits",
        group: "Long Bit",
        attribute_names: attrs,
        attributes: { Type: "Masonry", Size: '3/8"' },
        icon: "drill-bit",
        unit: "each",
        description: null,
        grainger_sku: "1ABC2",
        grainger_url: null,
        image_url: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Zip Ties",
        category: "Wiring & Connectors",
        group: null,
        attribute_names: [],
        attributes: {},
        icon: "zip-tie",
        unit: "bag",
        description: null,
        grainger_sku: null,
        grainger_url: null,
        image_url: null,
      },
    ]);
    const { rows, errors } = parseCatalogCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      group: "Long Bit",
      attribute_names: ["Type", "Size"],
      attributes: { Type: "Masonry", Size: '3/8"' },
      icon: "drill-bit",
      grainger_sku: "1ABC2",
    });
    expect(rows[1]).toMatchObject({ name: "Zip Ties", group: null, attributes: {}, icon: "zip-tie" });
  });

  it("requires options for grouped rows and rejects unknown icons", () => {
    const { rows, errors } = parseCatalogCsv('name,group,options,icon\nX,Long Bit,,\nY,,,not-an-icon\n,Hole Saw,"Size: 1""",hole-saw');
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Hole Saw — 1"', group: "Hole Saw", attributes: { Size: '1"' } });
  });
});
