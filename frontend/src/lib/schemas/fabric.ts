/**
 * Zod schemas for the Fabric (bobinas) feature.
 * Mirrors the Pydantic shapes from `backend/src/schemas/fabric.py`.
 *
 * Decimal columns are serialized as strings on the wire; the form layer
 * keeps everything as strings and validates positivity via Zod refinements,
 * then forwards the string to the backend.
 */

import { z } from "zod";

export const FABRIC_ROLL_KINDS = ["body", "rib"] as const;
export const FABRIC_TYPES = ["jersey", "fleece", "french_terry", "mesh", "rib"] as const;

export const fabricRollKindSchema = z.enum(FABRIC_ROLL_KINDS);
export const fabricTypeSchema = z.enum(FABRIC_TYPES);

export type FabricRollKind = z.infer<typeof fabricRollKindSchema>;
export type FabricType = z.infer<typeof fabricTypeSchema>;

export const fabricRollReadSchema = z.object({
  id: z.string(),
  received_at: z.string(),
  supplier_name: z.string(),
  kind: fabricRollKindSchema,
  fabric_type: fabricTypeSchema,
  initial_weight_kg: z.string(),
  current_weight_kg: z.string(),
  consumed_kg: z.string(),
  color: z.string(),
  price_per_kg: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type FabricRoll = z.infer<typeof fabricRollReadSchema>;

export const fabricRollPageSchema = z.object({
  items: z.array(fabricRollReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type FabricRollPage = z.infer<typeof fabricRollPageSchema>;

export type FabricRollFilters = {
  q?: string;
  kind?: FabricRollKind;
  fabric_type?: FabricType;
  page?: number;
  page_size?: number;
};

/**
 * Form-side schema. We keep weight + price as text inputs so the input cursor
 * doesn't jump on every keystroke. The `.refine` chain mirrors the backend
 * invariants so the user sees errors before submission.
 */
const decimalString = z
  .string()
  .trim()
  .min(1, { message: "validation.required" })
  .refine((value) => /^\d+(\.\d+)?$/.test(value) || /^\d+,\d+$/.test(value), {
    message: "validation.numeric",
  })
  .transform((value) => value.replace(",", "."));

export const fabricRollFormSchema = z
  .object({
    received_at: z
      .string()
      .trim()
      .min(1, { message: "validation.receivedAtRequired" }),
    supplier_name: z
      .string()
      .trim()
      .min(1, { message: "validation.supplierRequired" })
      .max(120),
    kind: fabricRollKindSchema,
    fabric_type: fabricTypeSchema,
    color: z
      .string()
      .trim()
      .min(1, { message: "validation.colorRequired" })
      .max(40),
    initial_weight_kg: decimalString,
    current_weight_kg: decimalString.optional(),
    price_per_kg: decimalString,
  })
  .superRefine((data, ctx) => {
    const initial = Number(data.initial_weight_kg);
    if (!Number.isFinite(initial) || initial <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["initial_weight_kg"],
        message: "validation.initialWeightPositive",
      });
    }
    const price = Number(data.price_per_kg);
    if (!Number.isFinite(price) || price < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["price_per_kg"],
        message: "validation.pricePositive",
      });
    }
    if (data.current_weight_kg !== undefined && data.current_weight_kg !== "") {
      const current = Number(data.current_weight_kg);
      if (!Number.isFinite(current) || current < 0) {
        ctx.addIssue({
          code: "custom",
          path: ["current_weight_kg"],
          message: "validation.currentWeightNonNegative",
        });
      } else if (Number.isFinite(initial) && current > initial) {
        ctx.addIssue({
          code: "custom",
          path: ["current_weight_kg"],
          message: "validation.currentExceedsInitial",
        });
      }
    }
  });

export type FabricRollFormValues = z.input<typeof fabricRollFormSchema>;
export type FabricRollFormPayload = z.output<typeof fabricRollFormSchema>;
