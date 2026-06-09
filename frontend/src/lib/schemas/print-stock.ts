/**
 * Zod schemas for the Print Stock (estoque de estampas / impresso) feature.
 *
 * Mirrors the Pydantic shapes from `backend/src/schemas/print_stock.py`. A single
 * append-only ledger carries a `direction` (entry/exit/adjustment); on-hand is
 * computed live per (print_design, product_color). The dimension is a free-text
 * colour string, NOT a variation FK.
 */

import { z } from "zod";

export const PRINT_STOCK_DIRECTIONS = ["entry", "exit", "adjustment"] as const;
export const printStockDirectionSchema = z.enum(PRINT_STOCK_DIRECTIONS);
export type PrintStockDirection = z.infer<typeof printStockDirectionSchema>;

// ---------- Nested DTOs ----------

export const printDesignMiniSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  image_url: z.string().nullable().optional(),
});
export type PrintDesignMini = z.infer<typeof printDesignMiniSchema>;

// ---------- Read shapes ----------

export const printStockLevelReadSchema = z.object({
  print_design_id: z.string(),
  product_color: z.string(),
  design: printDesignMiniSchema,
  on_hand: z.number().int(),
  entries_total: z.number().int(),
  exits_total: z.number().int(),
  last_movement_at: z.string().nullable().optional(),
});
export type PrintStockLevelRead = z.infer<typeof printStockLevelReadSchema>;

const pageMeta = {
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
};

export const printStockLevelPageSchema = z.object({
  items: z.array(printStockLevelReadSchema),
  ...pageMeta,
});
export type PrintStockLevelPage = z.infer<typeof printStockLevelPageSchema>;

export const printStockMovementReadSchema = z.object({
  id: z.string(),
  print_design_id: z.string(),
  product_color: z.string(),
  design: printDesignMiniSchema.nullable().optional(),
  direction: printStockDirectionSchema,
  quantity: z.number().int(),
  notes: z.string().nullable(),
  created_at: z.string(),
  batch: z.object({ id: z.string() }).nullable().optional(),
});
export type PrintStockMovementRead = z.infer<typeof printStockMovementReadSchema>;

export const printStockMovementPageSchema = z.object({
  items: z.array(printStockMovementReadSchema),
  ...pageMeta,
});
export type PrintStockMovementPage = z.infer<typeof printStockMovementPageSchema>;

// ---------- Create shapes ----------

export const printStockEntryCreateSchema = z.object({
  print_design_id: z.string().min(1),
  product_color: z.string().min(1).max(80),
  quantity: z.number().int().positive(),
  notes: z.string().max(500).optional().nullable(),
});
export type PrintStockEntryCreate = z.infer<typeof printStockEntryCreateSchema>;

export const printStockExitCreateSchema = z.object({
  print_design_id: z.string().min(1),
  product_color: z.string().min(1).max(80),
  quantity: z.number().int().positive(),
  notes: z.string().max(500).optional().nullable(),
});
export type PrintStockExitCreate = z.infer<typeof printStockExitCreateSchema>;

// ---------- Filters ----------

export type PrintStockLevelFilters = {
  q?: string;
  print_design_id?: string;
  product_color?: string;
  page?: number;
  page_size?: number;
};

export type PrintStockMovementFilters = {
  print_design_id?: string;
  product_color?: string;
  direction?: PrintStockDirection;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

// ---------- Adjust dialog form ----------

export const printStockAdjustFormSchema = z.object({
  direction: z.enum(["entry", "exit"]),
  print_design_id: z.string().min(1, { message: "validation.designRequired" }),
  product_color: z.string().trim().min(1, { message: "validation.colorRequired" }),
  quantity: z
    .string()
    .trim()
    .min(1, { message: "validation.quantityPositive" })
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, {
      message: "validation.quantityPositive",
    }),
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type PrintStockAdjustFormValues = z.infer<typeof printStockAdjustFormSchema>;
