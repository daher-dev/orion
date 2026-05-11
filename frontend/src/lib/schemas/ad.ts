/**
 * Zod schemas for the Ads (Anúncios) feature.
 *
 * Mirrors `backend/src/schemas/ad.py`. The read shape embeds a minimal
 * `AdProductMini` projection so the channel-grouped grid renders without
 * a second fetch per card.
 */

import { z } from "zod";

/**
 * Ecommerce channels supported by the Ad service. Order matches
 * `models.enums.Ecommerce` so the create form's channel grid renders in a
 * predictable order.
 */
export const ECOMMERCE_CHANNELS = [
  "shopee",
  "mercado_livre",
  "shopify",
  "instagram",
  "whatsapp",
  "other",
] as const;

export type Ecommerce = (typeof ECOMMERCE_CHANNELS)[number];

export const ecommerceSchema = z.enum(ECOMMERCE_CHANNELS);

export const adProductMiniSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
});

export type AdProductMini = z.infer<typeof adProductMiniSchema>;

export const adReadSchema = z.object({
  id: z.string(),
  title: z.string(),
  ecommerce: ecommerceSchema,
  external_id: z.string().nullable().optional(),
  product: adProductMiniSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type Ad = z.infer<typeof adReadSchema>;

export const adPageSchema = z.object({
  items: z.array(adReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type AdPage = z.infer<typeof adPageSchema>;

export type AdFilters = {
  q?: string;
  ecommerce?: Ecommerce;
  product_id?: string;
  page?: number;
  page_size?: number;
};

/**
 * Form-side schema. `external_id` is optional — channels like Instagram
 * don't have a stable listing id, so we accept an empty input and forward
 * `undefined` to the backend.
 */
export const adFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "validation.titleRequired" })
    .max(200, { message: "validation.titleTooLong" }),
  ecommerce: ecommerceSchema,
  external_id: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  product_id: z.string().min(1, { message: "validation.productRequired" }),
});

export type AdFormValues = z.input<typeof adFormSchema>;
export type AdFormPayload = z.output<typeof adFormSchema>;
