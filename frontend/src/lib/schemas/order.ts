/**
 * Zod schemas for the Orders (Pedidos) feature.
 *
 * Mirrors `backend/src/schemas/order.py`. The read shape embeds the ad
 * (with channel), the variation (with its product) and the client so the
 * list table and the detail page render without follow-up fetches.
 */

import { z } from "zod";
import { ECOMMERCE_CHANNELS } from "@/lib/schemas/ad";
import { SIZES } from "@/lib/schemas/product";

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const orderAdReadSchema = z.object({
  id: z.string(),
  title: z.string(),
  ecommerce: z.enum(ECOMMERCE_CHANNELS),
});

export type OrderAdRead = z.infer<typeof orderAdReadSchema>;

export const orderProductMiniSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

export const orderVariationReadSchema = z.object({
  id: z.string(),
  sku: z.string(),
  size: z.enum(SIZES),
  color: z.string(),
  color_code: z.string(),
  product: orderProductMiniSchema,
});

export type OrderVariationRead = z.infer<typeof orderVariationReadSchema>;

export const orderClientReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
});

export type OrderClientRead = z.infer<typeof orderClientReadSchema>;

export const orderReadSchema = z.object({
  id: z.string(),
  ad: orderAdReadSchema,
  variation: orderVariationReadSchema,
  client: orderClientReadSchema,
  quantity: z.number().int(),
  sale_price: z.string(), // Decimal serialised as a string by FastAPI
  ordered_at: z.string(),
  status: orderStatusSchema,
  external_order_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Order = z.infer<typeof orderReadSchema>;

export const orderPageSchema = z.object({
  items: z.array(orderReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type OrderPage = z.infer<typeof orderPageSchema>;

export type OrderFilters = {
  q?: string;
  status?: OrderStatus;
  channel?: (typeof ECOMMERCE_CHANNELS)[number];
  client_id?: string;
  ad_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

/**
 * Form schema. `external_order_id` is optional — Instagram or
 * WhatsApp orders rarely come with a stable channel-side id, so we
 * forward an empty string as `undefined`.
 */
export const orderFormSchema = z.object({
  client_id: z.string().min(1, { message: "validation.clientRequired" }),
  ad_id: z.string().min(1, { message: "validation.adRequired" }),
  variation_id: z.string().min(1, { message: "validation.variationRequired" }),
  quantity: z.coerce
    .number()
    .int()
    .min(1, { message: "validation.quantityPositive" }),
  sale_price: z.coerce
    .number()
    .min(0, { message: "validation.pricePositive" }),
  ordered_at: z
    .string()
    .min(1, { message: "validation.orderedAtRequired" }),
  external_order_id: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export type OrderFormValues = z.input<typeof orderFormSchema>;
export type OrderFormPayload = z.output<typeof orderFormSchema>;

/**
 * Wire payload sent to POST /v1/orders.
 */
export type OrderCreatePayload = {
  ad_id: string;
  variation_id: string;
  client_id: string;
  quantity: number;
  sale_price: string;
  ordered_at: string;
  external_order_id?: string;
};

export function buildOrderCreatePayload(
  parsed: OrderFormPayload,
): OrderCreatePayload {
  return {
    ad_id: parsed.ad_id,
    variation_id: parsed.variation_id,
    client_id: parsed.client_id,
    quantity: parsed.quantity,
    // The backend expects a string for the Decimal column.
    sale_price: parsed.sale_price.toFixed(2),
    ordered_at: new Date(parsed.ordered_at).toISOString(),
    external_order_id: parsed.external_order_id,
  };
}

/** Transitions allowed by the backend service. Keep in sync with `_FORWARD`. */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled", "returned"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};

export function canTransition(
  current: OrderStatus,
  target: OrderStatus,
): boolean {
  if (current === target) return true;
  return ALLOWED_TRANSITIONS[current]?.includes(target) ?? false;
}

/** Phases shown on the detail-page timeline (mirrors design's ORDER_PHASES). */
export const ORDER_TIMELINE_PHASES = [
  "pending",
  "paid",
  "shipped",
  "delivered",
] as const;

export type OrderTimelinePhase = (typeof ORDER_TIMELINE_PHASES)[number];

export function phaseIndex(status: OrderStatus): number {
  // Cancelled / returned don't sit on the linear rail — they leave the
  // currently-completed step highlighted up to the previous phase.
  const idx = ORDER_TIMELINE_PHASES.indexOf(status as OrderTimelinePhase);
  if (idx >= 0) return idx;
  return -1;
}
