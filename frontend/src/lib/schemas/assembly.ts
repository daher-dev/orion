/**
 * Zod schemas for the Assembly (Montagem · T5) feature.
 *
 * Mirrors `backend/src/schemas/assembly.py`. Assembly is an *action* (not a
 * kanban entity): a blank piece + a printed transfer are combined into a
 * finished product variation in one transaction. `AssembleBody` drives the
 * transition; `AssemblyRunRead` echoes the resolved/created SKU. `BuildableRow`
 * is the on-hand discovery assist (computed live, no writes): every
 * `(printed_transfer, candidate blank)` pair with positive on-hand, with
 * `max_buildable = min(blank.on_hand, printed_on_hand)`.
 */

import { z } from "zod";
import { printSideSchema } from "@/lib/schemas/print";
import { printDesignRefSchema } from "@/lib/schemas/print-order";
import { PRODUCT_TYPES } from "@/lib/schemas/product";

const pageMeta = {
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
};

// ---------- Run (POST /assembly response) ----------

export const assemblyVariationRefSchema = z.object({
  id: z.string(),
  sku: z.string(),
  size: z.string(),
  color: z.string(),
  color_code: z.string(),
});
export type AssemblyVariationRef = z.infer<typeof assemblyVariationRefSchema>;

export const assemblyRunReadSchema = z.object({
  id: z.string(),
  blank_piece_id: z.string(),
  printed_transfer_id: z.string(),
  variation: assemblyVariationRefSchema,
  sku: z.string(),
  quantity: z.number().int(),
  created_new_variation: z.boolean(),
  batch_id: z.string().nullable().optional(),
  created_at: z.string(),
});
export type AssemblyRun = z.infer<typeof assemblyRunReadSchema>;

// ---------- Buildable (GET /assembly/buildable) ----------

export const buildableSpecRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});
export type BuildableSpecRef = z.infer<typeof buildableSpecRefSchema>;

export const buildableBlankRefSchema = z.object({
  blank_piece_id: z.string(),
  spec: buildableSpecRefSchema,
  size: z.string(),
  color: z.string(),
  color_code: z.string(),
  on_hand: z.number().int(),
});
export type BuildableBlankRef = z.infer<typeof buildableBlankRefSchema>;

export const buildableRowSchema = z.object({
  printed_transfer_id: z.string(),
  design: printDesignRefSchema,
  side: printSideSchema,
  printed_on_hand: z.number().int(),
  blank: buildableBlankRefSchema,
  sku: z.string(),
  max_buildable: z.number().int(),
  product_type: z.enum(PRODUCT_TYPES),
});
export type BuildableRow = z.infer<typeof buildableRowSchema>;

export const assemblyBuildablePageSchema = z.object({
  items: z.array(buildableRowSchema),
  ...pageMeta,
});
export type AssemblyBuildablePage = z.infer<typeof assemblyBuildablePageSchema>;

// ---------- Payloads ----------

export type AssembleBody = {
  blank_piece_id: string;
  printed_transfer_id: string;
  quantity: number;
  batch_id?: string | null;
};

// ---------- Filters ----------

export type BuildableFilters = {
  q?: string;
  print_design_id?: string;
  spec_id?: string;
  page?: number;
  page_size?: number;
};

// ---------- Helpers ----------

/**
 * Predict the finished SKU for a blank + design — mirrors
 * `ProductVariation.make_sku` (`<SPEC>-<SIZE_UPPER>-<COLOR_UPPER>-<PRINT>`).
 * Used by the manual assemble sheet's live product preview before the run is
 * created; the authoritative SKU comes back on the `AssemblyRun` response.
 */
export function makeSku(specCode: string, size: string, colorCode: string, printCode?: string): string {
  const base = `${specCode}-${size.toUpperCase()}-${colorCode.toUpperCase()}`;
  return printCode ? `${base}-${printCode}` : base;
}
