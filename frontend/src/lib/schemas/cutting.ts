/**
 * Zod schemas for the Cutting (Corte) feature.
 *
 * Mirrors `backend/src/schemas/cutting.py`. A CuttingOrder is now keyed by a
 * product SPEC (ficha técnica) + a free-text colorway (`color` + 3-letter
 * `color_code`) instead of a product — cutting is print-agnostic. It ties that
 * spec/color to one mandatory body roll, optional rib roll, and a per-size set
 * of planned/actual outputs. The wire payload embeds a small spec + roll
 * projection so list rows can render without joins.
 *
 * When an order reaches DONE its actual outputs become *available cut pieces*
 * (see `availableCutReadSchema`) — the input the Costura "Disponível" view
 * draws from to create a remessa.
 */

import { z } from "zod";
import { SIZES, type Size } from "@/lib/schemas/product";

export const CUTTING_STATUSES = ["pending", "cutting", "done"] as const;
export type CuttingStatus = (typeof CUTTING_STATUSES)[number];
export const cuttingStatusSchema = z.enum(CUTTING_STATUSES);

export const cuttingOutputSchema = z.object({
  size: z.enum(SIZES),
  quantity: z.number().int().min(0),
});

export type CuttingOutput = z.infer<typeof cuttingOutputSchema>;

export const cuttingSpecRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
});

export const cuttingRollRefSchema = z.object({
  id: z.string(),
  code: z.string(),
});

export const cuttingReadSchema = z.object({
  id: z.string(),
  spec: cuttingSpecRefSchema,
  color: z.string(),
  color_code: z.string(),
  body_roll: cuttingRollRefSchema,
  rib_roll: cuttingRollRefSchema.nullable().optional(),
  status: cuttingStatusSchema,
  planned_outputs: z.array(cuttingOutputSchema).default([]),
  actual_outputs: z.array(cuttingOutputSchema).default([]),
  cut_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CuttingOrder = z.infer<typeof cuttingReadSchema>;

export const cuttingPageSchema = z.object({
  items: z.array(cuttingReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type CuttingPage = z.infer<typeof cuttingPageSchema>;

/**
 * Per-run production cost record. Mirrors `backend/src/schemas/cutting_cost.py`
 * (`CuttingCostRead`). Frozen at the moment the order is marked done; all
 * money/weight values arrive as plain numbers.
 */
export const cuttingRunCostSchema = z.object({
  cutting_order_id: z.string(),
  total_pieces: z.number().int(),
  body_fabric_kg: z.number(),
  ribana_kg: z.number(),
  body_price_per_kg: z.number(),
  rib_price_per_kg: z.number().nullable().optional(),
  fabric_cost: z.number(),
  ribana_cost: z.number(),
  trims_cost: z.number(),
  labor_cost: z.number(),
  total_cost: z.number(),
  cost_per_piece: z.number(),
  yield_pieces_per_kg: z.number(),
});

export type CuttingRunCost = z.infer<typeof cuttingRunCostSchema>;

export type CuttingFilters = {
  q?: string;
  status?: CuttingStatus;
  spec_id?: string;
  page?: number;
  page_size?: number;
};

// ---------- Available cut pieces (T2 input) ----------

export const availableCutSizeSchema = z.object({
  size: z.enum(SIZES),
  available: z.number().int(),
});
export type AvailableCutSize = z.infer<typeof availableCutSizeSchema>;

export const availableCutReadSchema = z.object({
  cutting_order_id: z.string(),
  code: z.string(),
  spec: cuttingSpecRefSchema,
  color: z.string(),
  color_code: z.string(),
  sizes: z.array(availableCutSizeSchema),
  total_available: z.number().int(),
});
export type AvailableCut = z.infer<typeof availableCutReadSchema>;

export const availableCutsPageSchema = z.object({
  items: z.array(availableCutReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});
export type AvailableCutsPage = z.infer<typeof availableCutsPageSchema>;

export type AvailableCutsFilters = {
  q?: string;
  spec_id?: string;
  page?: number;
  page_size?: number;
};

/**
 * Form-side schema. Per-size planned quantities live on a `sizes` map so
 * the form layer can render the size grid without a `useFieldArray`. The
 * transform step flattens the map into the backend's `planned_outputs`
 * list of `{size, quantity}`.
 */
const sizeQuantityMap = z
  .object({
    p: z.coerce.number().int().min(0).default(0),
    m: z.coerce.number().int().min(0).default(0),
    g: z.coerce.number().int().min(0).default(0),
    gg: z.coerce.number().int().min(0).default(0),
    u: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    const total = data.p + data.m + data.g + data.gg + data.u;
    if (total <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["p"],
        message: "validation.atLeastOneSize",
      });
    }
  });

export const cuttingFormSchema = z
  .object({
    spec_id: z.string().min(1, { message: "validation.specRequired" }),
    color: z.string().trim().min(1, { message: "validation.colorRequired" }).max(40),
    color_code: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, { message: "validation.colorCodeFormat" }),
    body_roll_id: z.string().min(1, { message: "validation.bodyRollRequired" }),
    rib_roll_id: z
      .string()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    sizes: sizeQuantityMap,
    cut_at: z
      .string()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined)),
  })
  .superRefine((data, ctx) => {
    if (data.rib_roll_id && data.rib_roll_id === data.body_roll_id) {
      ctx.addIssue({
        code: "custom",
        path: ["rib_roll_id"],
        message: "validation.rollsDiffer",
      });
    }
  });

export type CuttingFormValues = z.input<typeof cuttingFormSchema>;
export type CuttingFormParsed = z.output<typeof cuttingFormSchema>;

/**
 * Wire payload sent to POST /v1/cutting. Mirrors `CuttingCreate`.
 */
export type CuttingCreatePayload = {
  spec_id: string;
  color: string;
  color_code: string;
  body_roll_id: string;
  rib_roll_id?: string;
  planned_outputs: Array<{ size: Size; quantity: number }>;
  cut_at?: string;
};

export function buildCuttingCreatePayload(
  parsed: CuttingFormParsed,
): CuttingCreatePayload {
  const planned_outputs: Array<{ size: Size; quantity: number }> = [];
  for (const size of SIZES) {
    const quantity = parsed.sizes[size];
    if (quantity > 0) planned_outputs.push({ size, quantity });
  }
  return {
    spec_id: parsed.spec_id,
    color: parsed.color,
    color_code: parsed.color_code,
    body_roll_id: parsed.body_roll_id,
    rib_roll_id: parsed.rib_roll_id,
    planned_outputs,
    cut_at: parsed.cut_at,
  };
}

export function sumOutputs(outputs: CuttingOutput[] | undefined): number {
  if (!outputs) return 0;
  return outputs.reduce((acc, o) => acc + o.quantity, 0);
}
