import { z } from "zod";
import { cleanName } from "@/lib/names";

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
  .union([httpUrl, z.literal(""), z.null(), z.undefined()])
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
});
export type CatalogItemInput = z.input<typeof catalogItemSchema>;

export const categoryNameSchema = z.string().trim().min(1, "Name is required").max(60);

export const teamNameSchema = z.string().trim().min(1, "Name is required").max(100);

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});
