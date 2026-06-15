/**
 * Zod schemas for the Printed Transfers (estampados) tier.
 *
 * Replaces the old `print-stock` schemas. Mirrors the Pydantic shapes from
 * `backend/src/schemas/printed_transfer.py`. A `PrintedTransfer` is keyed by
 * `(print_design, side)` via a real FK — NOT the old free-text `product_color`.
 * On-hand is derived live from an append-only ledger
 * (`printed_transfer_movements`): ENTRY and ADJUSTMENT credit, EXIT debits.
 * Quantities are integer counts; `low_stock` is a boolean.
 */

import { z } from "zod";

export const PRINTED_MOVEMENT_KINDS = ["entry", "exit", "adjustment"] as const;
export const printedMovementKindSchema = z.enum(PRINTED_MOVEMENT_KINDS);
export type PrintedMovementKind = z.infer<typeof printedMovementKindSchema>;

export const PRINT_SIDES = ["front", "back"] as const;
export const printSideSchema = z.enum(PRINT_SIDES);
export type PrintSide = z.infer<typeof printSideSchema>;

const pageMeta = {
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
};

// ---------- Nested DTOs ----------

export const printDesignMiniSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  image_url: z.string().nullable().optional(),
});
export type PrintDesignMini = z.infer<typeof printDesignMiniSchema>;

// ---------- Levels (printed transfer x on-hand) ----------

export const printedTransferLevelReadSchema = z.object({
  printed_transfer_id: z.string(),
  print_design_id: z.string(),
  design: printDesignMiniSchema,
  side: printSideSchema,
  min_stock: z.number().int().nullable().optional(),
  on_hand: z.number().int(),
  in_production: z.number().int(),
  low_stock: z.boolean(),
  entries_total: z.number().int(),
  exits_total: z.number().int(),
  last_movement_at: z.string().nullable().optional(),
});
export type PrintedTransferLevelRead = z.infer<typeof printedTransferLevelReadSchema>;

export const printedTransferLevelPageSchema = z.object({
  items: z.array(printedTransferLevelReadSchema),
  ...pageMeta,
});
export type PrintedTransferLevelPage = z.infer<typeof printedTransferLevelPageSchema>;

// ---------- Movements ledger ----------

export const printedMovementReadSchema = z.object({
  id: z.string(),
  printed_transfer_id: z.string(),
  design: printDesignMiniSchema.nullable().optional(),
  side: printSideSchema,
  kind: printedMovementKindSchema,
  quantity: z.number().int(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type PrintedMovementRead = z.infer<typeof printedMovementReadSchema>;

export const printedMovementPageSchema = z.object({
  items: z.array(printedMovementReadSchema),
  ...pageMeta,
});
export type PrintedMovementPage = z.infer<typeof printedMovementPageSchema>;

// ---------- Create payloads ----------

export type PrintedTransferCreate = {
  print_design_id: string;
  side: PrintSide;
  min_stock?: number | null;
};

export type PrintedMovementCreate = {
  printed_transfer_id: string;
  kind: PrintedMovementKind;
  quantity: number;
  notes?: string | null;
};

// ---------- Filters ----------

export type PrintedTransferLevelFilters = {
  q?: string;
  print_design_id?: string;
  side?: PrintSide;
  low_stock_only?: boolean;
  page?: number;
  page_size?: number;
};

export type PrintedMovementFilters = {
  printed_transfer_id?: string;
  print_design_id?: string;
  side?: PrintSide;
  kind?: PrintedMovementKind;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};
