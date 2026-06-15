/**
 * Zod schemas for the Paper Rolls (bobinas de papel/filme) tier.
 *
 * Mirrors the Pydantic shapes from `backend/src/schemas/paper_roll.py`. Like
 * Fabric rolls, a `PaperRoll` carries an authoritative `current_meters` column
 * (NOT a ledger sum) plus a `paper_roll_movements` ledger for history. Decimal
 * columns serialize as strings on the wire, so metered fields are `z.string()`;
 * the form layer keeps them as strings and validates positivity via refinements.
 */

import { z } from "zod";

export const PAPER_TYPES = ["dtf_film", "sublimation_paper", "transfer_paper"] as const;
export const paperTypeSchema = z.enum(PAPER_TYPES);
export type PaperType = z.infer<typeof paperTypeSchema>;

export const PAPER_MOVEMENT_KINDS = ["entry", "exit", "adjustment"] as const;
export const paperMovementKindSchema = z.enum(PAPER_MOVEMENT_KINDS);
export type PaperMovementKind = z.infer<typeof paperMovementKindSchema>;

const pageMeta = {
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
};

// ---------- Catalog read ----------

export const paperRollReadSchema = z.object({
  id: z.string(),
  received_at: z.string(),
  supplier_name: z.string(),
  paper_type: paperTypeSchema,
  width_cm: z.number().int(),
  initial_meters: z.string(),
  current_meters: z.string(),
  consumed_meters: z.string(),
  min_stock: z.string().nullable().optional(),
  on_hand: z.string(),
  low_stock: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PaperRoll = z.infer<typeof paperRollReadSchema>;

export const paperRollPageSchema = z.object({
  items: z.array(paperRollReadSchema),
  ...pageMeta,
});
export type PaperRollPage = z.infer<typeof paperRollPageSchema>;

// ---------- Movements ledger ----------

export const paperRollMiniSchema = z.object({
  id: z.string(),
  paper_type: paperTypeSchema,
  supplier_name: z.string(),
});
export type PaperRollMini = z.infer<typeof paperRollMiniSchema>;

export const paperMovementReadSchema = z.object({
  id: z.string(),
  paper_roll_id: z.string(),
  paper_roll: paperRollMiniSchema.nullable().optional(),
  kind: paperMovementKindSchema,
  quantity: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type PaperMovementRead = z.infer<typeof paperMovementReadSchema>;

export const paperMovementPageSchema = z.object({
  items: z.array(paperMovementReadSchema),
  ...pageMeta,
});
export type PaperMovementPage = z.infer<typeof paperMovementPageSchema>;

// ---------- Create / update payloads ----------

export type PaperRollCreate = {
  received_at: string;
  supplier_name: string;
  paper_type: PaperType;
  width_cm: number;
  initial_meters: string;
  current_meters?: string | null;
  min_stock?: string | null;
};
export type PaperRollUpdate = Partial<PaperRollCreate>;

export type PaperRollConsume = {
  quantity: string;
  notes?: string | null;
};

export type PaperMovementCreate = {
  paper_roll_id: string;
  kind: PaperMovementKind;
  quantity: string;
  notes?: string | null;
};

// ---------- Filters ----------

export type PaperRollFilters = {
  q?: string;
  paper_type?: PaperType;
  low_stock_only?: boolean;
  page?: number;
  page_size?: number;
};

export type PaperMovementFilters = {
  paper_roll_id?: string;
  kind?: PaperMovementKind;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

// ---------- Form schemas ----------

const decimalString = z
  .string()
  .trim()
  .min(1, { message: "validation.required" })
  .refine((value) => /^\d+(\.\d+)?$/.test(value) || /^\d+,\d+$/.test(value), {
    message: "validation.numeric",
  })
  .transform((value) => value.replace(",", "."));

export const paperRollFormSchema = z.object({
  paper_type: paperTypeSchema,
  width_cm: z
    .string()
    .trim()
    .min(1, { message: "validation.required" })
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, { message: "validation.numeric" }),
  initial_meters: decimalString.refine((v) => Number(v) > 0, {
    message: "validation.positive",
  }),
  supplier_name: z.string().trim().min(1, { message: "validation.supplierRequired" }).max(120),
  received_at: z.string().trim().min(1, { message: "validation.required" }),
});
export type PaperRollFormValues = z.input<typeof paperRollFormSchema>;
export type PaperRollFormPayload = z.output<typeof paperRollFormSchema>;
