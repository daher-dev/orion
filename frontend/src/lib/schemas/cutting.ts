/**
 * Zod schemas for the Cutting (Corte) feature.
 *
 * Mirrors `backend/src/schemas/cutting.py`. A CuttingOrder ties a product
 * to one mandatory body roll, optional rib roll, and a per-size set of
 * planned/actual outputs. The wire payload embeds a small product +
 * roll-reference projection so list rows can render without joins.
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

export const cuttingProductRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable().optional(),
});

export const cuttingRollRefSchema = z.object({
  id: z.string(),
  code: z.string(),
});

export const cuttingReadSchema = z.object({
  id: z.string(),
  product: cuttingProductRefSchema,
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

export type CuttingFilters = {
  q?: string;
  status?: CuttingStatus;
  product_id?: string;
  page?: number;
  page_size?: number;
};

/**
 * Form-side schema. Per-size planned quantities live on a `sizes` map so
 * the form layer can render four `NumberInput`s without a `useFieldArray`.
 * The transform step flattens the map into the backend's `planned_outputs`
 * list of `{size, quantity}`.
 */
const sizeQuantityMap = z
  .object({
    p: z.coerce.number().int().min(0).default(0),
    m: z.coerce.number().int().min(0).default(0),
    g: z.coerce.number().int().min(0).default(0),
    gg: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    const total = data.p + data.m + data.g + data.gg;
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
    product_id: z.string().min(1, { message: "validation.productRequired" }),
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
  product_id: string;
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
    product_id: parsed.product_id,
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
