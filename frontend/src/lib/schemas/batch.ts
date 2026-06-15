/**
 * Zod schemas for the Batches (Lotes de produção) feature.
 *
 * Mirrors `backend/src/schemas/batch.py`. A batch groups orders into one
 * production/dispatch run and drives separation-label printing. The Montador
 * DTF send and per-design print adjustments were retired in the WIP rework.
 */

import { z } from "zod";

export const BATCH_STATUSES = [
  "open",
  "in_production",
  "dispatched",
  "done",
  "cancelled",
] as const;

export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const batchStatusSchema = z.enum(BATCH_STATUSES);

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
  completed_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
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

export type BatchCreatePayload = {
  order_ids: string[];
  name?: string | null;
};

export type BatchFilters = {
  status?: BatchStatus;
  page?: number;
  page_size?: number;
};
