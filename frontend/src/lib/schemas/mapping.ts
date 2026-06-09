/**
 * Zod schemas for the De/Para mapping feature (item do pedido → variação/SKU).
 *
 * Mirrors `backend/src/schemas/mapping.py`. Each imported OrderItem whose
 * `variation_id` is still null is a "pending" De/Para row. The UI resolves it
 * to the right internal Product → Variation (SKU); the estampa follows from
 * the matched variation's product.
 */

import { z } from "zod";

export const MAPPING_FILTERS = ["pending", "linked", "all"] as const;
export type MappingFilter = (typeof MAPPING_FILTERS)[number];

// Sizes match `models.enums.Size` (lowercase p/m/g/gg).
export const MAPPING_SIZES = ["p", "m", "g", "gg"] as const;
export type MappingSize = (typeof MAPPING_SIZES)[number];

// Marketplace channels match `models.enums.Ecommerce`.
export const MAPPING_CHANNELS = [
  "shopee",
  "mercado_livre",
  "shopify",
  "instagram",
  "whatsapp",
  "other",
] as const;
export type MappingChannel = (typeof MAPPING_CHANNELS)[number];

export const mappingSuggestionSchema = z.object({
  variation_id: z.string(),
  product_id: z.string(),
  product_name: z.string(),
  sku: z.string(),
  color: z.string(),
  size: z.enum(MAPPING_SIZES),
  print_design_code: z.string().nullable().optional(),
  print_design_name: z.string().nullable().optional(),
  score: z.number().int(),
});

export type MappingSuggestion = z.infer<typeof mappingSuggestionSchema>;

export const mappingItemSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  ad_id: z.string(),
  ad_title: z.string(),
  channel: z.enum(MAPPING_CHANNELS),
  ad_sku: z.string().nullable().optional(),
  variation_text: z.string().nullable().optional(),

  linked: z.boolean(),
  variation_id: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  product_id: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  size: z.enum(MAPPING_SIZES).nullable().optional(),
  print_design_code: z.string().nullable().optional(),
  print_design_name: z.string().nullable().optional(),

  suggestion: mappingSuggestionSchema.nullable().optional(),
});

export type MappingItem = z.infer<typeof mappingItemSchema>;

export const mappingProgressSchema = z.object({
  total: z.number().int(),
  linked: z.number().int(),
  pending: z.number().int(),
  with_suggestion: z.number().int(),
});

export type MappingProgress = z.infer<typeof mappingProgressSchema>;

export const mappingItemsResponseSchema = z.object({
  items: z.array(mappingItemSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
  progress: mappingProgressSchema,
});

export type MappingItemsResponse = z.infer<typeof mappingItemsResponseSchema>;

export const acceptAllResultSchema = z.object({
  accepted: z.number().int(),
});

export type AcceptAllResult = z.infer<typeof acceptAllResultSchema>;

export type MappingFilters = {
  filter?: MappingFilter;
  q?: string;
  page?: number;
  page_size?: number;
};

export type SetVariationPayload = {
  variation_id: string;
};
