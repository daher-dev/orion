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

// ---------- detail (computed estampa grid) ----------

/** Print design reference embedded in a grid row — mirrors `PrintDesignRef`. */
export const printDesignRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  technique: z.string(),
  image_url: z.string().nullable().optional(),
});

export type PrintDesignRef = z.infer<typeof printDesignRefSchema>;

/**
 * One row of the lote's per-estampa production grid (computed live, grouped by
 * print design). Mirrors `BatchEstampaRow`.
 * - `items` — pieces needing this estampa.
 * - `to_print` — pieces still missing a FRONT printed transfer.
 * - `montado` — pieces already covered by finished stock (`is_assembled` when ≥ items).
 * - `enviado` — pieces whose order already shipped (`is_shipped` when all shipped).
 */
export const batchEstampaRowSchema = z.object({
  design: printDesignRefSchema.nullable().optional(),
  code: z.string(),
  items: z.number().int(),
  to_print: z.number().int(),
  montado: z.number().int(),
  is_assembled: z.boolean(),
  enviado: z.number().int(),
  is_shipped: z.boolean(),
});

export type BatchEstampaRow = z.infer<typeof batchEstampaRowSchema>;

/** `GET /v1/batches/{id}` — the lean fields + the computed grid + roll-ups. */
export const batchDetailReadSchema = batchReadSchema.extend({
  estampas: z.array(batchEstampaRowSchema).default([]),
  orders_ready: z.number().int().default(0),
  orders_total: z.number().int().default(0),
  pieces_total: z.number().int().default(0),
  to_print_total: z.number().int().default(0),
  needs_assembly: z.boolean().default(false),
  can_ship: z.boolean().default(false),
});

export type BatchDetail = z.infer<typeof batchDetailReadSchema>;

// ---------- montar / enviar ----------

export const batchAssembledRowSchema = z.object({
  variation_id: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
});

export type BatchAssembledRow = z.infer<typeof batchAssembledRowSchema>;

export const batchAssembleSkippedSchema = z.object({
  variation_id: z.string(),
  sku: z.string(),
  reason: z.string(),
});

export type BatchAssembleSkipped = z.infer<typeof batchAssembleSkippedSchema>;

/** Result of `POST /v1/batches/{id}/assemble` — recomputed grid + montar summary. */
export const batchAssembleResultSchema = z.object({
  batch: batchDetailReadSchema,
  assembled: z.array(batchAssembledRowSchema).default([]),
  skipped: z.array(batchAssembleSkippedSchema).default([]),
});

export type BatchAssembleResult = z.infer<typeof batchAssembleResultSchema>;

/** Optional per-design partial-montar request rows. */
export type BatchAssembleRow = {
  design_id: string;
  quantity: number;
};

export type BatchAssemblePayload = {
  rows?: BatchAssembleRow[];
};

export type BatchCreatePayload = {
  order_ids: string[];
  name?: string | null;
};

export type BatchFilters = {
  status?: BatchStatus;
  page?: number;
  page_size?: number;
};
