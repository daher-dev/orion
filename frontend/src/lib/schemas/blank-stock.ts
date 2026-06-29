/**
 * Zod schemas for the Blank Pieces (peças lisas) tier.
 *
 * Mirrors the Pydantic shapes from `backend/src/schemas/blank_stock.py`. A
 * `BlankPiece` is a print-agnostic garment body keyed by
 * `(spec, size, color_code)`. On-hand is derived live from an append-only
 * ledger (`blank_piece_movements`): ENTRY and ADJUSTMENT credit, EXIT debits.
 * Quantities are integer counts (not Decimal like the metered rolls), so
 * `on_hand`/`in_production`/`quantity` are numbers and `low_stock` a boolean.
 */

import { z } from "zod";
import { SIZES } from "@/lib/schemas/product";

export const BLANK_MOVEMENT_KINDS = ["entry", "exit", "adjustment"] as const;
export const blankMovementKindSchema = z.enum(BLANK_MOVEMENT_KINDS);
export type BlankMovementKind = z.infer<typeof blankMovementKindSchema>;

const pageMeta = {
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
};

// ---------- Nested DTOs ----------

export const specMiniSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type SpecMini = z.infer<typeof specMiniSchema>;

export const blankPieceMiniSchema = z.object({
  id: z.string(),
  spec_code: z.string(),
  size: z.enum(SIZES),
  color: z.string(),
});
export type BlankPieceMini = z.infer<typeof blankPieceMiniSchema>;

// ---------- Levels (blank piece x on-hand) ----------

export const blankPieceLevelReadSchema = z.object({
  blank_piece_id: z.string(),
  spec_id: z.string(),
  spec: specMiniSchema,
  size: z.enum(SIZES),
  color: z.string(),
  color_code: z.string(),
  min_stock: z.number().int().nullable().optional(),
  on_hand: z.number().int(),
  in_production: z.number().int(),
  low_stock: z.boolean(),
  entries_total: z.number().int(),
  exits_total: z.number().int(),
  last_movement_at: z.string().nullable().optional(),
});
export type BlankPieceLevelRead = z.infer<typeof blankPieceLevelReadSchema>;

export const blankPieceLevelPageSchema = z.object({
  items: z.array(blankPieceLevelReadSchema),
  ...pageMeta,
});
export type BlankPieceLevelPage = z.infer<typeof blankPieceLevelPageSchema>;

// Tenant-wide headline totals (every SKU, not the current page) for the KPIs.
export const blankPieceLevelSummarySchema = z.object({
  total_on_hand: z.number().int(),
  below_min: z.number().int(),
  sku_count: z.number().int(),
});
export type BlankPieceLevelSummary = z.infer<typeof blankPieceLevelSummarySchema>;

// ---------- Movements ledger ----------

export const blankMovementReadSchema = z.object({
  id: z.string(),
  blank_piece_id: z.string(),
  blank_piece: blankPieceMiniSchema.nullable().optional(),
  kind: blankMovementKindSchema,
  quantity: z.number().int(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type BlankMovementRead = z.infer<typeof blankMovementReadSchema>;

export const blankMovementPageSchema = z.object({
  items: z.array(blankMovementReadSchema),
  ...pageMeta,
});
export type BlankMovementPage = z.infer<typeof blankMovementPageSchema>;

// ---------- Create payloads ----------

export type BlankPieceCreate = {
  spec_id: string;
  size: (typeof SIZES)[number];
  color: string;
  color_code: string;
  min_stock?: number | null;
};

export type BlankMovementCreate = {
  blank_piece_id: string;
  kind: BlankMovementKind;
  quantity: number;
  notes?: string | null;
};

// ---------- Filters ----------

export type BlankPieceLevelFilters = {
  q?: string;
  spec_id?: string;
  size?: (typeof SIZES)[number];
  low_stock_only?: boolean;
  page?: number;
  page_size?: number;
};

export type BlankMovementFilters = {
  blank_piece_id?: string;
  kind?: BlankMovementKind;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};
