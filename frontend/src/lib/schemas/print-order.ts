/**
 * Zod schemas for the Print Orders (Impressão · T4) feature.
 *
 * Mirrors `backend/src/schemas/print_order.py`. A PrintOrder is keyed by a
 * transfer-based `PrintDesign` plus an optional paper/film roll, with a status
 * machine (pending → printing → done) and per-`(variation, side)` planned vs
 * printed counts. The wire payload embeds a small design + roll + variation
 * projection so cards and tables render without joins.
 *
 * Completing the order ("Lançar impressos") is a separate explicit endpoint
 * (`POST /{id}/complete`) — it debits the paper roll's meters and credits
 * printed transfers (design + side, summed across variations). The PATCH only
 * moves status / records counts; it never posts stock.
 */

import { z } from "zod";
import { printTechniqueSchema, printSideSchema, type PrintSide } from "@/lib/schemas/print";

export const PRINT_ORDER_STATUSES = ["pending", "printing", "done"] as const;
export type PrintOrderStatus = (typeof PRINT_ORDER_STATUSES)[number];
export const printOrderStatusSchema = z.enum(PRINT_ORDER_STATUSES);

const pageMeta = {
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
};

// ---------- Nested read DTOs ----------

export const printDesignRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  technique: printTechniqueSchema,
  image_url: z.string().nullable().optional(),
});
export type PrintDesignRef = z.infer<typeof printDesignRefSchema>;

export const paperRollRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  paper_type: z.string(),
});
export type PaperRollRef = z.infer<typeof paperRollRefSchema>;

export const printVariationRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  ink_hex: z.string(),
});
export type PrintVariationRef = z.infer<typeof printVariationRefSchema>;

export const printOrderOutputReadSchema = z.object({
  print_design_variation_id: z.string(),
  variation: printVariationRefSchema,
  side: printSideSchema,
  planned_quantity: z.number().int(),
  printed_quantity: z.number().int(),
});
export type PrintOrderOutputRead = z.infer<typeof printOrderOutputReadSchema>;

export const printOrderReadSchema = z.object({
  id: z.string(),
  code: z.string(),
  design: printDesignRefSchema,
  paper_roll: paperRollRefSchema.nullable().optional(),
  status: printOrderStatusSchema,
  technique: printTechniqueSchema,
  rate_m_per_piece: z.number(),
  total_planned: z.number().int(),
  total_printed: z.number().int(),
  estimated_meters: z.number(),
  meters_consumed: z.string().nullable().optional(),
  printed_at: z.string().nullable().optional(),
  outputs: z.array(printOrderOutputReadSchema).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PrintOrder = z.infer<typeof printOrderReadSchema>;

export const printOrderPageSchema = z.object({
  items: z.array(printOrderReadSchema),
  ...pageMeta,
});
export type PrintOrderPage = z.infer<typeof printOrderPageSchema>;

// ---------- Create / update / complete payloads ----------

export type PrintOrderOutputItem = {
  print_design_variation_id: string;
  side: PrintSide;
  planned_quantity: number;
};

export type PrintOrderPrintedItem = {
  print_design_variation_id: string;
  side: PrintSide;
  printed_quantity: number;
};

export type PrintOrderCreatePayload = {
  print_design_id: string;
  paper_roll_id?: string | null;
  planned_outputs: PrintOrderOutputItem[];
};

export type PrintOrderUpdatePayload = {
  status?: PrintOrderStatus;
  paper_roll_id?: string | null;
  printed_outputs?: PrintOrderPrintedItem[];
};

export type PrintOrderCompletePayload = {
  meters_consumed?: string | null;
};

// ---------- Filters ----------

export type PrintOrderFilters = {
  q?: string;
  status?: PrintOrderStatus;
  print_design_id?: string;
  page?: number;
  page_size?: number;
};

// ---------- Helpers ----------

/** Total printed across all `(variation, side)` outputs (card/sheet totals). */
export function sumPrintOutputs(
  outputs: PrintOrderOutputRead[] | undefined,
  key: "planned_quantity" | "printed_quantity",
): number {
  if (!outputs) return 0;
  return outputs.reduce((acc, o) => acc + o[key], 0);
}
