/**
 * Zod schemas for the Consumables / supply inventory (insumos) feature.
 *
 * Mirrors the Pydantic shapes from `backend/src/schemas/supply.py`. A `Supply`
 * is a CRUD catalog entry; on-hand is derived live from an append-only ledger
 * (`supply_movements`): ENTRY and ADJUSTMENT credit, EXIT debits. Decimal
 * columns are serialized as strings on the wire — the form layer keeps numeric
 * fields as strings and validates positivity via Zod refinements.
 */

import { z } from "zod";

export const SUPPLY_MOVEMENT_KINDS = ["entry", "exit", "adjustment"] as const;
export const supplyMovementKindSchema = z.enum(SUPPLY_MOVEMENT_KINDS);
export type SupplyMovementKind = z.infer<typeof supplyMovementKindSchema>;

// ---------- Catalog read ----------

export const supplyReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  unit_cost: z.string(),
  min_stock: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Supply = z.infer<typeof supplyReadSchema>;

const pageMeta = {
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
};

export const supplyPageSchema = z.object({
  items: z.array(supplyReadSchema),
  ...pageMeta,
});
export type SupplyPage = z.infer<typeof supplyPageSchema>;

// ---------- Levels (supply x on-hand) ----------

export const supplyLevelReadSchema = z.object({
  supply_id: z.string(),
  name: z.string(),
  unit: z.string(),
  unit_cost: z.string(),
  min_stock: z.string().nullable().optional(),
  on_hand: z.string(),
  entries_total: z.string(),
  exits_total: z.string(),
  last_movement_at: z.string().nullable().optional(),
});
export type SupplyLevelRead = z.infer<typeof supplyLevelReadSchema>;

export const supplyLevelPageSchema = z.object({
  items: z.array(supplyLevelReadSchema),
  ...pageMeta,
});
export type SupplyLevelPage = z.infer<typeof supplyLevelPageSchema>;

// ---------- Movements ledger ----------

export const supplyMiniSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
});
export type SupplyMini = z.infer<typeof supplyMiniSchema>;

export const supplyMovementReadSchema = z.object({
  id: z.string(),
  supply_id: z.string(),
  supply: supplyMiniSchema.nullable().optional(),
  kind: supplyMovementKindSchema,
  quantity: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type SupplyMovementRead = z.infer<typeof supplyMovementReadSchema>;

export const supplyMovementPageSchema = z.object({
  items: z.array(supplyMovementReadSchema),
  ...pageMeta,
});
export type SupplyMovementPage = z.infer<typeof supplyMovementPageSchema>;

// ---------- Create / update payloads ----------

export type SupplyCreate = {
  name: string;
  unit: string;
  unit_cost: string;
  min_stock?: string | null;
  notes?: string | null;
};
export type SupplyUpdate = Partial<SupplyCreate>;

export type SupplyMovementCreate = {
  supply_id: string;
  kind: SupplyMovementKind;
  quantity: string;
  notes?: string | null;
};

// ---------- Filters ----------

export type SupplyFilters = {
  q?: string;
  page?: number;
  page_size?: number;
};

export type SupplyLevelFilters = {
  q?: string;
  low_stock_only?: boolean;
  page?: number;
  page_size?: number;
};

export type SupplyMovementFilters = {
  supply_id?: string;
  kind?: SupplyMovementKind;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

// ---------- Form schemas ----------

/**
 * Numeric text field. We keep amounts as strings so the input cursor doesn't
 * jump on every keystroke; the comma → dot transform mirrors the backend
 * Decimal-string wire contract (and pt-BR comma decimals).
 */
const decimalString = z
  .string()
  .trim()
  .min(1, { message: "validation.required" })
  .refine((value) => /^\d+(\.\d+)?$/.test(value) || /^\d+,\d+$/.test(value), {
    message: "validation.numeric",
  })
  .transform((value) => value.replace(",", "."));

const optionalDecimalString = z
  .string()
  .trim()
  .transform((value) => value.replace(",", "."))
  .refine((value) => value === "" || /^\d+(\.\d+)?$/.test(value), {
    message: "validation.numeric",
  })
  .optional();

export const supplyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "validation.nameRequired" })
    .max(120),
  unit: z
    .string()
    .trim()
    .min(1, { message: "validation.unitRequired" })
    .max(20),
  unit_cost: decimalString,
  min_stock: optionalDecimalString,
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type SupplyFormValues = z.input<typeof supplyFormSchema>;
export type SupplyFormPayload = z.output<typeof supplyFormSchema>;

export const supplyAdjustFormSchema = z.object({
  kind: supplyMovementKindSchema,
  supply_id: z.string().min(1, { message: "validation.supplyRequired" }),
  quantity: decimalString.refine((v) => Number(v) > 0, {
    message: "validation.quantityPositive",
  }),
  notes: z.string().max(500).optional().or(z.literal("")),
});
export type SupplyAdjustFormValues = z.input<typeof supplyAdjustFormSchema>;
export type SupplyAdjustFormPayload = z.output<typeof supplyAdjustFormSchema>;
