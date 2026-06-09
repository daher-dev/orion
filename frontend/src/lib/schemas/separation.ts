/**
 * Zod schemas for the Order separation / labeling / check-out workflow (Separação).
 *
 * Mirrors `backend/src/schemas/separation.py` and `backend/src/schemas/order_item.py`.
 * The separation workflow turns an order into one printable 100×50mm label per
 * physical piece (`SeparationLabel`), then lets an operator scan each label's QR
 * (the per-piece `tracking_code`) to confirm the piece at check-out.
 */

import { z } from "zod";
import { SIZES } from "@/lib/schemas/product";

export const SEPARATION_STATUSES = [
  "pending",
  "label_printed",
  "checked",
] as const;

export type SeparationStatus = (typeof SEPARATION_STATUSES)[number];

export const separationStatusSchema = z.enum(SEPARATION_STATUSES);

/** Read shape for a single separation piece — mirrors `OrderItemRead`. */
export const orderItemReadSchema = z.object({
  id: z.string(),
  order_id: z.string(),
  variation_id: z.string().nullable().optional(),
  tracking_code: z.string().nullable().optional(),
  status: separationStatusSchema,
  checked_at: z.string().nullable().optional(),
  checked_by: z.string().nullable().optional(),
  mapped_print: z.string().nullable().optional(),
  item_index: z.number().int(),
  total_items: z.number().int(),
});

export type OrderItem = z.infer<typeof orderItemReadSchema>;

/** A single printable 100×50mm separation label — mirrors `SeparationLabel`. */
export const separationLabelSchema = z.object({
  item_id: z.string(),
  order_id: z.string(),
  order_code: z.string(),
  tracking_code: z.string(),
  qr_data: z.string(),
  item_index: z.number().int(),
  total_items: z.number().int(),
  status: separationStatusSchema,
  sku: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  color_code: z.string().nullable().optional(),
  size: z.enum(SIZES).nullable().optional(),
  mapped_print: z.string().nullable().optional(),
});

export type SeparationLabel = z.infer<typeof separationLabelSchema>;

/** Result of generating/printing an order's labels — mirrors `GenerateLabelsResponse`. */
export const generateLabelsResponseSchema = z.object({
  order_id: z.string(),
  order_code: z.string(),
  total_items: z.number().int(),
  labels: z.array(separationLabelSchema).default([]),
});

export type GenerateLabelsResponse = z.infer<typeof generateLabelsResponseSchema>;

/** Result of a scan-check — mirrors `ScanCheckResponse`. */
export const scanCheckResponseSchema = z.object({
  item_id: z.string(),
  order_id: z.string(),
  tracking_code: z.string(),
  status: separationStatusSchema,
  item_index: z.number().int(),
  total_items: z.number().int(),
  checked_at: z.string().nullable().optional(),
  checked_by: z.string().nullable().optional(),
  already_checked: z.boolean().default(false),
});

export type ScanCheckResponse = z.infer<typeof scanCheckResponseSchema>;

/** Scan-to-check request body — mirrors `ScanCheckRequest`. */
export type ScanCheckPayload = {
  tracking_code: string;
};
