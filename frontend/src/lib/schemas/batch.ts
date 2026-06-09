/**
 * Zod schemas for the Batches (Lotes de produção) feature.
 *
 * Mirrors `backend/src/schemas/batch.py`. A batch groups orders into one
 * production/dispatch run, aggregates the print designs they need, and drives
 * separation-label printing and the Montador DTF send.
 */

import { z } from "zod";

export const BATCH_STATUSES = [
  "open",
  "adjusted",
  "printed",
  "done",
  "cancelled",
] as const;

export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const batchStatusSchema = z.enum(BATCH_STATUSES);

export const batchAdjustmentReadSchema = z.object({
  print_design_id: z.string(),
  print_design_code: z.string().nullable().optional(),
  print_design_name: z.string().nullable().optional(),
  product_color: z.string(),
  qty_needed: z.number().int(),
  qty_stock: z.number().int(),
  qty_to_print: z.number().int(),
  prints_sent: z.boolean(),
});

export type BatchAdjustment = z.infer<typeof batchAdjustmentReadSchema>;

export const batchListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable().optional(),
  status: batchStatusSchema,
  total_orders: z.number().int(),
  total_pieces: z.number().int(),
  created_at: z.string(),
});

export type BatchListItem = z.infer<typeof batchListItemSchema>;

export const batchReadSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable().optional(),
  status: batchStatusSchema,
  total_orders: z.number().int(),
  total_pieces: z.number().int(),
  labels_printed_at: z.string().nullable().optional(),
  prints_sent_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  adjustments: z.array(batchAdjustmentReadSchema).default([]),
});

export type Batch = z.infer<typeof batchReadSchema>;

export const batchPageSchema = z.object({
  items: z.array(batchListItemSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type BatchPage = z.infer<typeof batchPageSchema>;

export const montadorSendResultSchema = z.object({
  total: z.number().int(),
  succeeded: z.number().int(),
  failed: z.number().int(),
  results: z.array(z.record(z.string(), z.unknown())),
});

export type MontadorSendResult = z.infer<typeof montadorSendResultSchema>;

/**
 * Cross-batch demand-driven print queue — what still needs printing right now,
 * aggregated across OPEN/ADJUSTED batches by (design, colour).
 * Mirrors `PrintQueueItem` / `PrintQueueRead` in `backend/src/schemas/batch.py`.
 */
export const printQueueDesignMiniSchema = z.object({
  id: z.string(),
  code: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

export const printQueueItemSchema = z.object({
  print_design_id: z.string().nullable().optional(),
  product_color: z.string(),
  design: printQueueDesignMiniSchema.nullable().optional(),
  qty_to_print: z.number().int(),
  qty_needed: z.number().int(),
  qty_stock: z.number().int(),
  batch_count: z.number().int(),
});

export type PrintQueueItem = z.infer<typeof printQueueItemSchema>;

export const printQueueReadSchema = z.object({
  items: z.array(printQueueItemSchema).default([]),
  total_to_print: z.number().int(),
});

export type PrintQueue = z.infer<typeof printQueueReadSchema>;

export type BatchCreatePayload = {
  order_ids: string[];
  name?: string | null;
};

export type BatchAdjustmentUpdatePayload = {
  adjustments: { print_design_id: string; qty_to_print: number }[];
};

export type BatchFilters = {
  status?: BatchStatus;
  page?: number;
  page_size?: number;
};
