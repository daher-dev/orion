/**
 * Zod schemas for the Products (catálogo) feature.
 * Mirrors backend/src/schemas/product.py.
 *
 * Sizes and product types are union enums, so the form layer can build
 * type-safe pickers without round-tripping through the backend constants.
 */

import { z } from "zod";

export const PRODUCT_TYPES = ["tshirt", "sweatshirt", "shorts", "tanktop"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

// `u` = Único (one-size garments such as ecobag); matches the backend `Size.U`
// enum value. Spec-keyed cutting (Corte) can target Size.U garments, so the
// size set must carry it even though most garments only use p/m/g/gg.
export const SIZES = ["p", "m", "g", "gg", "u"] as const;
export type Size = (typeof SIZES)[number];

export const variationItemSchema = z.object({
  size: z.enum(SIZES),
  color: z.string().min(1).max(40),
  color_code: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, { message: "validation.colorCodeFormat" }),
});

export type VariationItem = z.infer<typeof variationItemSchema>;

export const variationReadSchema = z.object({
  id: z.string(),
  size: z.enum(SIZES),
  color: z.string(),
  color_code: z.string(),
  sku: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type VariationRead = z.infer<typeof variationReadSchema>;

export const productReadSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  name: z.string(),
  product_type: z.enum(PRODUCT_TYPES),
  spec_id: z.string(),
  print_id: z.string().nullable(),
  variations: z.array(variationReadSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Product = z.infer<typeof productReadSchema>;

export const productPageSchema = z.object({
  items: z.array(productReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type ProductPage = z.infer<typeof productPageSchema>;

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, { message: "validation.nameRequired" }).max(120),
  product_type: z.enum(PRODUCT_TYPES),
  spec_id: z.string().min(1, { message: "validation.specRequired" }),
  print_id: z.string().nullable().optional(),
  variations: z
    .array(variationItemSchema)
    .min(1, { message: "validation.variationsRequired" }),
});

export type ProductCreate = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  product_type: z.enum(PRODUCT_TYPES).optional(),
  spec_id: z.string().optional(),
  print_id: z.string().nullable().optional(),
  variations: z.array(variationItemSchema).min(1).optional(),
});

export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export type ProductFilters = {
  q?: string;
  product_type?: ProductType;
  spec_id?: string;
  print_id?: string;
  page?: number;
  page_size?: number;
};
