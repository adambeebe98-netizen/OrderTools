/**
 * Product groups & variants — pure helpers shared by the technician picker,
 * the manager editor, CSV import and tests.
 *
 * A group lists attribute names in the order technicians choose them (e.g.
 * ["Type", "Size"]). Each variant is a real catalog item whose `attributes`
 * object holds a value per attribute (e.g. { Type: "Masonry", Size: '3/8"' }).
 */

export type Attributes = Record<string, string>;

export type VariantLike = { id: string; attributes: Attributes; sort_order?: number };

export const MAX_ATTRIBUTES = 4;

/** Display name stored on the catalog item, e.g. 'Long Bit — Masonry — 3/8"'. */
export function variantName(groupName: string, attributeNames: string[], attributes: Attributes): string {
  const values = attributeNames.map((a) => attributes[a]?.trim()).filter(Boolean);
  return [groupName.trim(), ...values].join(" — ");
}

/** Keep only the group's attributes, trimmed, without empty values. */
export function cleanAttributes(attributeNames: string[], attributes: Attributes): Attributes {
  const out: Attributes = {};
  for (const name of attributeNames) {
    const v = attributes[name]?.trim();
    if (v) out[name] = v.slice(0, 40);
  }
  return out;
}

export function sameAttributes(a: Attributes, b: Attributes): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
}

function matches(v: VariantLike, selection: Attributes, upTo: string[]) {
  return upTo.every((name) => !selection[name] || v.attributes[name] === selection[name]);
}

/**
 * Values offered for attribute `index`, given what was picked for earlier
 * attributes. Ordered by the variants' display order (so managers control it).
 * Variants that don't use this attribute are ignored for this step.
 */
export function optionsFor(variants: VariantLike[], attributeNames: string[], selection: Attributes, index: number): string[] {
  const name = attributeNames[index];
  const earlier = attributeNames.slice(0, index);
  const ordered = [...variants].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const seen: string[] = [];
  for (const v of ordered) {
    if (!matches(v, selection, earlier)) continue;
    const value = v.attributes[name];
    if (value && !seen.includes(value)) seen.push(value);
  }
  return seen;
}

/**
 * Normalize a (partial) selection: drop picks that are no longer possible,
 * auto-pick attributes that have exactly one option, and return the variant
 * once the selection identifies exactly one.
 */
export function resolveSelection(
  variants: VariantLike[],
  attributeNames: string[],
  selection: Attributes,
): { selection: Attributes; variant: VariantLike | null; steps: { name: string; options: string[]; value: string | null }[] } {
  const next: Attributes = {};
  const steps: { name: string; options: string[]; value: string | null }[] = [];
  for (let i = 0; i < attributeNames.length; i++) {
    const name = attributeNames[i];
    const options = optionsFor(variants, attributeNames, next, i);
    if (options.length === 0) continue; // attribute not used by remaining variants
    let value = selection[name] && options.includes(selection[name]) ? selection[name] : null;
    if (!value && options.length === 1) value = options[0];
    if (value) next[name] = value;
    steps.push({ name, options, value });
  }
  const candidates = variants.filter((v) => matches(v, next, attributeNames));
  const complete = steps.every((s) => s.value);
  const variant =
    complete && candidates.length > 0
      ? (candidates.find((v) => attributeNames.every((n) => (v.attributes[n] ?? null) === (next[n] ?? null))) ?? candidates[0])
      : null;
  return { selection: next, variant, steps };
}

/** Parse "Type: Masonry | Size: 3/8\"" (CSV) into an attributes object + ordered names. */
export function parseAttributeString(input: string | null | undefined): { names: string[]; attributes: Attributes } {
  const names: string[] = [];
  const attributes: Attributes = {};
  for (const part of (input ?? "").split("|")) {
    const idx = part.indexOf(":");
    if (idx < 1) continue;
    const name = part.slice(0, idx).trim().slice(0, 30);
    const value = part.slice(idx + 1).trim().slice(0, 40);
    if (!name || !value || names.includes(name) || names.length >= MAX_ATTRIBUTES) continue;
    names.push(name);
    attributes[name] = value;
  }
  return { names, attributes };
}

export function formatAttributeString(attributeNames: string[], attributes: Attributes): string {
  return attributeNames
    .filter((n) => attributes[n])
    .map((n) => `${n}: ${attributes[n]}`)
    .join(" | ");
}

/** Short summary for a group card, e.g. "Wood · Masonry" or "3 sizes". */
export function groupSummary(variants: VariantLike[], attributeNames: string[]): string {
  if (attributeNames.length === 0 || variants.length === 0) return "";
  const first = optionsFor(variants, attributeNames, {}, 0);
  if (first.length > 1 && first.length <= 3) return first.join(" · ");
  if (first.length === 1 && attributeNames.length > 1) {
    const second = optionsFor(variants, attributeNames, { [attributeNames[0]]: first[0] }, 1);
    return [first[0], second.length > 1 ? `${second.length} ${plural(attributeNames[1])}` : second[0]].filter(Boolean).join(" · ");
  }
  if (first.length === 1) return first[0];
  return `${first.length} ${plural(attributeNames[0])}`;
}

function plural(name: string) {
  const n = name.toLowerCase();
  return n.endsWith("s") ? n : `${n}s`;
}
