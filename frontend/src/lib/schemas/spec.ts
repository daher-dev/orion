/**
 * Zod schemas for the Specs (fichas técnicas) feature.
 * Mirrors the Pydantic shapes from `backend/src/schemas/spec.py`.
 *
 * All numeric monetary fields use string-typed money in the wire payload
 * (FastAPI serializes Decimal as string by default). The form layer parses
 * UI-friendly numbers and stringifies on submit.
 */

import { z } from "zod";

export const FABRIC_TYPES = ["jersey", "fleece", "french_terry", "mesh", "rib"] as const;
export const TRIM_TYPES = [
  "button",
  "zipper",
  "label",
  "drawstring",
  "snap",
  "hook",
  "eyelet",
  "elastic",
] as const;

export const fabricTypeSchema = z.enum(FABRIC_TYPES);
export const trimTypeSchema = z.enum(TRIM_TYPES);

export type FabricType = z.infer<typeof fabricTypeSchema>;
export type TrimType = z.infer<typeof trimTypeSchema>;

const moneyOnWire = z.union([z.string(), z.number()]).transform((v) => String(v));
const moneyOptional = moneyOnWire.nullable().optional();

export const trimItemSchema = z.object({
  trim_type: trimTypeSchema,
  unit_price: moneyOnWire,
  quantity: z.coerce.number().int().min(1),
});

export type TrimItemPayload = z.input<typeof trimItemSchema>;
export type TrimItem = z.output<typeof trimItemSchema>;

export const specCreateSchema = z
  .object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(120),
    fabric_type: fabricTypeSchema,
    fabric_grammage_gsm: z.coerce.number().int().positive(),
    fabric_weight_per_piece_g: moneyOnWire,
    has_ribana: z.boolean().default(false),
    ribana_weight_pct: moneyOptional,
    labor_cost: moneyOnWire,
    sale_price: moneyOptional,
    notes: z.string().nullable().optional(),
    trims: z.array(trimItemSchema).default([]),
  })
  .refine(
    (data) => {
      if (data.has_ribana) return data.ribana_weight_pct !== undefined && data.ribana_weight_pct !== null && data.ribana_weight_pct !== "";
      return true;
    },
    {
      message: "ribana_weight_pct required when has_ribana is true",
      path: ["ribana_weight_pct"],
    },
  );

export type SpecCreateInput = z.input<typeof specCreateSchema>;
export type SpecCreate = z.output<typeof specCreateSchema>;

export const specUpdateSchema = z
  .object({
    code: z.string().min(1).max(20).optional(),
    name: z.string().min(1).max(120).optional(),
    fabric_type: fabricTypeSchema.optional(),
    fabric_grammage_gsm: z.coerce.number().int().positive().optional(),
    fabric_weight_per_piece_g: moneyOnWire.optional(),
    has_ribana: z.boolean().optional(),
    ribana_weight_pct: moneyOptional,
    labor_cost: moneyOnWire.optional(),
    sale_price: moneyOptional,
    notes: z.string().nullable().optional(),
    trims: z.array(trimItemSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.has_ribana === true) {
        return data.ribana_weight_pct !== undefined && data.ribana_weight_pct !== null && data.ribana_weight_pct !== "";
      }
      return true;
    },
    {
      message: "ribana_weight_pct required when has_ribana is true",
      path: ["ribana_weight_pct"],
    },
  );

export type SpecUpdate = z.output<typeof specUpdateSchema>;
export type SpecUpdateInput = z.input<typeof specUpdateSchema>;

export const specReadSchema = z.object({
  id: z.string().uuid(),
  company_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  fabric_type: fabricTypeSchema,
  fabric_grammage_gsm: z.number(),
  fabric_weight_per_piece_g: z.string(),
  has_ribana: z.boolean(),
  ribana_weight_pct: z.string().nullable(),
  labor_cost: z.string(),
  sale_price: z.string().nullable(),
  notes: z.string().nullable(),
  trims: z.array(
    z.object({
      trim_type: trimTypeSchema,
      unit_price: z.string(),
      quantity: z.number().int(),
    }),
  ),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SpecRead = z.infer<typeof specReadSchema>;

export const specPageSchema = z.object({
  items: z.array(specReadSchema),
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
  has_more: z.boolean(),
});

export type SpecPage = z.infer<typeof specPageSchema>;

export type SpecFilters = {
  q?: string;
  fabric_type?: FabricType;
};
