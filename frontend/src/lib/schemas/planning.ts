/**
 * Zod schemas for the Planning (Planejamento) feature — Phase 5.
 *
 * Mirrors `backend/src/schemas/planning.py`. Planning is a **pure computed
 * service** over the existing fulfillment domain (orders + order_items) plus the
 * WIP tiers. It surfaces two kinds of production suggestions — *cortes* (cutting,
 * grouped by `spec + color_code` with a per-size grade) and *impressões*
 * (printing, one per print design, FRONT as the reference side) — each driven by
 * a dual engine (open-order demand + min-stock reorder), minus work already in
 * production (WIP).
 *
 * The two create endpoints take a list of selected suggestion *keys*; the server
 * recomputes the suggestions inside the transaction and creates PENDING cutting /
 * print orders with no roll / paper assigned yet. Partial success is allowed — a
 * skipped suggestion (stale / silkscreen / no variation / …) never rolls back the
 * created ones.
 */

import { z } from "zod";
import { printDesignRefSchema } from "@/lib/schemas/print-order";
import { SIZES } from "@/lib/schemas/product";

const sizeSchema = z.enum(SIZES);

// The backend `ProductType` enum carries garment names (camiseta, moletom, …),
// which the frontend product schema does not yet model 1:1 (a Phase-1 carry-over
// gap). `product_type` here is purely decorative — it drives the garment glyph —
// so we accept it as a loose string and map it to a glyph at the render site
// (see `garmentGlyphType`), rather than a strict enum that would reject a valid
// response.
const productTypeSchema = z.string();

// String classification fields (plain literals — no PG enum involved, matches the
// prototype wire shape verbatim).
export const PLANNING_STATES = ["pronto", "lisa", "impresso", "ambos"] as const;
export type PlanningState = (typeof PLANNING_STATES)[number];
export const planningStateSchema = z.enum(PLANNING_STATES);

export const SUGGESTION_SOURCES = ["demanda", "estoque"] as const;
export type SuggestionSource = (typeof SUGGESTION_SOURCES)[number];
export const suggestionSourceSchema = z.enum(SUGGESTION_SOURCES);

export const PNG_FLAGS = ["ok", "pending"] as const;
export type PngFlagValue = (typeof PNG_FLAGS)[number];
export const pngFlagSchema = z.enum(PNG_FLAGS);

// ---------- shared refs ----------

export const planningSpecRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type PlanningSpecRef = z.infer<typeof planningSpecRefSchema>;

// ---------- per-demand-SKU breakdown ----------

export const planningSkuSchema = z.object({
  key: z.string(),
  design: printDesignRefSchema,
  spec: planningSpecRefSchema,
  product_type: productTypeSchema,
  color: z.string(),
  color_code: z.string(),
  size: sizeSchema,
  needed: z.number().int(),
  finished: z.number().int(),
  net: z.number().int(),
  blank_have: z.number().int(),
  printed_have: z.number().int(),
  blank_short: z.number().int(),
  printed_short: z.number().int(),
  buildable: z.number().int(),
  state: planningStateSchema,
  order_count: z.number().int(),
});
export type PlanningSku = z.infer<typeof planningSkuSchema>;

// ---------- corte suggestions ----------

export const planningCorteGradeRowSchema = z.object({
  size: sizeSchema,
  qty: z.number().int(),
  demand_qty: z.number().int(),
  stock_qty: z.number().int(),
});
export type PlanningCorteGradeRow = z.infer<typeof planningCorteGradeRowSchema>;

export const planningCorteSchema = z.object({
  key: z.string(),
  spec: planningSpecRefSchema,
  product_type: productTypeSchema,
  color: z.string(),
  color_code: z.string(),
  total: z.number().int(),
  demand: z.number().int(),
  stock: z.number().int(),
  order_count: z.number().int(),
  grade_rows: z.array(planningCorteGradeRowSchema),
  sources: z.array(suggestionSourceSchema),
});
export type PlanningCorte = z.infer<typeof planningCorteSchema>;

// ---------- impressão suggestions ----------

export const planningImpressaoSchema = z.object({
  key: z.string(),
  design: printDesignRefSchema,
  total: z.number().int(),
  demand: z.number().int(),
  stock: z.number().int(),
  order_count: z.number().int(),
  png: pngFlagSchema,
  sources: z.array(suggestionSourceSchema),
});
export type PlanningImpressao = z.infer<typeof planningImpressaoSchema>;

// ---------- totals ----------

export const planningTotalsSchema = z.object({
  toCut: z.number().int(),
  toPrint: z.number().int(),
  cortes: z.number().int(),
  impressoes: z.number().int(),
  demandDriven: z.number().int(),
  stockDriven: z.number().int(),
});
export type PlanningTotals = z.infer<typeof planningTotalsSchema>;

export const planningSuggestionsSchema = z.object({
  skus: z.array(planningSkuSchema),
  cortes: z.array(planningCorteSchema),
  impressoes: z.array(planningImpressaoSchema),
  totals: planningTotalsSchema,
});
export type PlanningSuggestions = z.infer<typeof planningSuggestionsSchema>;

// ---------- bulk-create: cutting ----------

export const planningCutCreatedSchema = z.object({
  key: z.string(),
  cutting_order_id: z.string(),
  code: z.string(),
  total: z.number().int(),
});
export type PlanningCutCreated = z.infer<typeof planningCutCreatedSchema>;

export const planningSkippedSchema = z.object({
  key: z.string(),
  reason: z.enum(["stale", "spec_not_found"]),
});
export type PlanningSkipped = z.infer<typeof planningSkippedSchema>;

export const planningCutResultSchema = z.object({
  created: z.array(planningCutCreatedSchema),
  skipped: z.array(planningSkippedSchema),
  created_count: z.number().int(),
});
export type PlanningCutResult = z.infer<typeof planningCutResultSchema>;

export type PlanningCutCreate = {
  keys: string[];
};

// ---------- bulk-create: printing ----------

export const planningPrintCreatedSchema = z.object({
  key: z.string(),
  print_order_id: z.string(),
  code: z.string(),
  total: z.number().int(),
});
export type PlanningPrintCreated = z.infer<typeof planningPrintCreatedSchema>;

export const planningPrintSkippedSchema = z.object({
  key: z.string(),
  reason: z.enum(["stale", "no_variation", "no_front_side", "silkscreen"]),
});
export type PlanningPrintSkipped = z.infer<typeof planningPrintSkippedSchema>;

export const planningPrintResultSchema = z.object({
  created: z.array(planningPrintCreatedSchema),
  skipped: z.array(planningPrintSkippedSchema),
  created_count: z.number().int(),
});
export type PlanningPrintResult = z.infer<typeof planningPrintResultSchema>;

export type PlanningPrintCreate = {
  keys: string[];
};
