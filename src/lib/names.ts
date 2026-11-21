/** Collapse whitespace and trim a technician's display name. */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** Key used to match technicians by name (mirrors public.normalize_name in SQL). */
export function nameKey(name: string): string {
  return cleanName(name).toLowerCase();
}

/** Key used to group custom ("other") items for the shopping list and review. */
export function customItemKey(name: string): string {
  return cleanName(name)
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/[^a-z0-9"'./ ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Random URL-safe suffix for team links. */
export function randomSuffix(length = 6): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function makeTeamSlug(teamName: string): string {
  const base = slugify(teamName) || "team";
  return `${base}-${randomSuffix()}`;
}
