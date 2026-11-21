import { z } from "zod";
import { cleanName } from "@/lib/names";
import { SUPPLY_ICON_KEYS } from "@/lib/icon-names";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a full link starting with https://");

const optionalUrl = z
  .union([httpUrl, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

export const technicianNameSchema = z
  .string()
  .transform(cleanName)
  .pipe(z.string().min(1, "Enter your name").max(60, "Name is too long"));

export const quantitySchema = z.coerce.number().int().min(1).max(999);

export const requestLineSchema = z.union([
  z.object({
    catalog_item_id: z.string().uuid(),
    quantity: quantitySchema,
  }),
  z.object({
    custom_name: z.string().trim().min(1, "Enter an item name").max(120),
    quantity: quantitySchema,
    custom_note: optionalText(500),
    custom_url: optionalUrl,
  }),
]);

export const submitRequestSchema = z.object({
  name: technicianNameSchema,
  items: z.array(requestLineSchema).min(1, "Add at least one item").max(50, "Too many items"),
  note: optionalText(500),
  // Honeypot: real users never fill this hidden field.
  website: z.string().max(200).optional(),
});
export type SubmitRequestInput = z.input<typeof submitRequestSchema>;

export const historyLookupSchema = z.object({
  name: technicianNameSchema,
});

export const catalogItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  category_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  description: optionalText(500),
  unit: optionalText(20),
  grainger_sku: optionalText(40),
  grainger_url: optionalUrl,
  image_url: optionalUrl,
  icon: z
    .enum(SUPPLY_ICON_KEYS)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});
// Icon arrives as a plain string from forms; the schema checks it is a known icon.
export type CatalogItemInput = Omit<z.input<typeof catalogItemSchema>, "icon"> & { icon?: string | null };

export const categoryNameSchema = z.string().trim().min(1, "Name is required").max(60);

export const teamNameSchema = z.string().trim().min(1, "Name is required").max(100);

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

const attributeName = z.string().trim().min(1, "Option names can't be blank").max(30);

export const productGroupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  category_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  description: optionalText(300),
  icon: z
    .enum(SUPPLY_ICON_KEYS)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  attribute_names: z
    .array(attributeName)
    .min(1, "Add at least one option, like Size")
    .max(4, "Up to 4 options")
    .refine((a) => new Set(a.map((x) => x.toLowerCase())).size === a.length, "Option names must be different"),
});
export type ProductGroupInput = Omit<z.input<typeof productGroupSchema>, "icon"> & { icon?: string | null };

export const variantSchema = z.object({
  attributes: z.record(z.string(), z.string().trim().max(40)),
  unit: optionalText(20),
  description: optionalText(500),
  grainger_sku: optionalText(40),
  grainger_url: optionalUrl,
  image_url: optionalUrl,
});
export type VariantInput = z.input<typeof variantSchema>;
