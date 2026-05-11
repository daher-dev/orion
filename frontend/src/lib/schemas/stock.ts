/**
 * Zod schemas for the Stock (estoque) feature.
 *
 * Mirrors the Pydantic shapes from `backend/src/schemas/stock.py`. The append-only
 * ledger surfaces as two CREATE shapes (entry / exit) plus a UNION read shape for
 * the interleaved movements view.
 */

import { z } from "zod";

export const STOCK_SOURCES = ["shipment", "adjustment", "return"] as const;
export const STOCK_EXIT_REASONS = ["sale", "adjustment", "loss"] as const;
export const SIZES = ["p", "m", "g", "gg"] as const;
export const MOVEMENT_TYPES = ["entry", "exit"] as const;

export const stockSourceSchema = z.enum(STOCK_SOURCES);
export const stockExitReasonSchema = z.enum(STOCK_EXIT_REASONS);
export const sizeSchema = z.enum(SIZES);

export type StockSource = z.infer<typeof stockSourceSchema>;
export type StockExitReason = z.infer<typeof stockExitReasonSchema>;
export type Size = z.infer<typeof sizeSchema>;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// ---------- Read shapes ----------

export const stockProductMiniSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
});
export type StockProductMini = z.infer<typeof stockProductMiniSchema>;

export const variationStockReadSchema = z.object({
  variation_id: z.string(),
  sku: z.string(),
  size: sizeSchema,
  color: z.string(),
  color_code: z.string(),
  product: stockProductMiniSchema,
  on_hand: z.number().int(),
  entries_total: z.number().int(),
  exits_total: z.number().int(),
  last_movement_at: z.string().nullable().optional(),
});
export type VariationStockRead = z.infer<typeof variationStockReadSchema>;

const pageMeta = {
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
};

export const stockPageSchema = z.object({
  items: z.array(variationStockReadSchema),
  ...pageMeta,
});
export type StockPage = z.infer<typeof stockPageSchema>;

// ---------- Movement union (entry/exit) ----------

export const stockEntryReadSchema = z.object({
  type: z.literal("entry"),
  id: z.string(),
  variation_id: z.string(),
  sku: z.string(),
  source: stockSourceSchema,
  quantity: z.number().int(),
  notes: z.string().nullable(),
  created_at: z.string(),
  shipment: z.object({ id: z.string() }).nullable().optional(),
});
export type StockEntryRead = z.infer<typeof stockEntryReadSchema>;

export const stockExitReadSchema = z.object({
  type: z.literal("exit"),
  id: z.string(),
  variation_id: z.string(),
  sku: z.string(),
  reason: stockExitReasonSchema,
  quantity: z.number().int(),
  notes: z.string().nullable(),
  created_at: z.string(),
  order: z.object({ id: z.string() }).nullable().optional(),
});
export type StockExitRead = z.infer<typeof stockExitReadSchema>;

export const stockMovementReadSchema = z.union([stockEntryReadSchema, stockExitReadSchema]);
export type StockMovementRead = z.infer<typeof stockMovementReadSchema>;

export const movementsPageSchema = z.object({
  items: z.array(stockMovementReadSchema),
  ...pageMeta,
});
export type MovementsPage = z.infer<typeof movementsPageSchema>;

// ---------- Create shapes ----------

// The POST endpoints respond WITHOUT the `type` discriminator (it's only attached
// when entries are surfaced inside the movements union). Frontend hooks consume
// these flat shapes directly.
export type StockEntryServerResponse = Omit<StockEntryRead, "type">;
export type StockExitServerResponse = Omit<StockExitRead, "type">;

export const stockEntryCreateSchema = z.object({
  variation_id: z.string().min(1),
  quantity: z.number().int().positive(),
  source: stockSourceSchema.default("adjustment"),
  notes: z.string().max(500).optional().nullable(),
});
export type StockEntryCreate = z.infer<typeof stockEntryCreateSchema>;

export const stockExitCreateSchema = z.object({
  variation_id: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: stockExitReasonSchema.default("adjustment"),
  notes: z.string().max(500).optional().nullable(),
});
export type StockExitCreate = z.infer<typeof stockExitCreateSchema>;

// ---------- Filters ----------

export type StockFilters = {
  q?: string;
  product_id?: string;
  low_stock_only?: boolean;
  threshold?: number;
  page?: number;
  page_size?: number;
};

export type MovementsFilters = {
  variation_id?: string;
  date_from?: string;
  date_to?: string;
  type?: MovementType;
  reason_or_source?: string;
  page?: number;
  page_size?: number;
};

// ---------- Adjust dialog form ----------

export const stockAdjustFormSchema = z.object({
  direction: z.enum(["entry", "exit"]),
  variation_id: z.string().min(1, { message: "validation.variationRequired" }),
  quantity: z
    .string()
    .trim()
    .min(1, { message: "validation.quantityPositive" })
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "validation.quantityPositive",
    }),
  reason_or_source: z.string().min(1),
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type StockAdjustFormValues = z.infer<typeof stockAdjustFormSchema>;
