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

// Movement-ledger direction. ENTRY + ADJUSTMENT credit current_weight_kg, EXIT
// debits it (cutting DONE writes EXIT rows automatically with cutting_order_id
// provenance; manual receive/adjust uses this form). Mirrors the paper tier.
export const FABRIC_MOVEMENT_KINDS = ["entry", "exit", "adjustment"] as const;
export const fabricMovementKindSchema = z.enum(FABRIC_MOVEMENT_KINDS);
export type FabricMovementKind = z.infer<typeof fabricMovementKindSchema>;

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

// ---------- Movements ledger ----------

export const fabricRollMiniSchema = z.object({
  id: z.string(),
  fabric_type: fabricTypeSchema,
  supplier_name: z.string(),
  color: z.string(),
});
export type FabricRollMini = z.infer<typeof fabricRollMiniSchema>;

export const fabricMovementReadSchema = z.object({
  id: z.string(),
  fabric_roll_id: z.string(),
  fabric_roll: fabricRollMiniSchema.nullable().optional(),
  kind: fabricMovementKindSchema,
  // Decimal kg serialized as a string on the wire.
  quantity: z.string(),
  // Provenance: set on EXIT rows written by a cutting order's DONE transition.
  cutting_order_id: z.string().nullable().optional(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type FabricMovementRead = z.infer<typeof fabricMovementReadSchema>;

export const fabricMovementPageSchema = z.object({
  items: z.array(fabricMovementReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});
export type FabricMovementPage = z.infer<typeof fabricMovementPageSchema>;

export type FabricMovementFilters = {
  fabric_roll_id?: string;
  kind?: FabricMovementKind;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
};

export type FabricMovementCreate = {
  fabric_roll_id: string;
  kind: FabricMovementKind;
  quantity: string;
  notes?: string | null;
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

/**
 * Form schema for a manual fabric-roll movement (entrada/saída/ajuste). The
 * quantity is kept as text (kg) and normalised to a dot-decimal string for the
 * wire; the backend clamps EXIT at 0 and adds ENTRY/ADJUSTMENT without an upper
 * bound.
 */
export const fabricMovementFormSchema = z.object({
  fabric_roll_id: z.string().min(1, { message: "validation.required" }),
  kind: fabricMovementKindSchema,
  quantity: decimalString.refine((value) => Number(value) > 0, {
    message: "validation.positive",
  }),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type FabricMovementFormValues = z.input<typeof fabricMovementFormSchema>;
export type FabricMovementFormParsed = z.output<typeof fabricMovementFormSchema>;

export function buildFabricMovementPayload(
  parsed: FabricMovementFormParsed,
): FabricMovementCreate {
  return {
    fabric_roll_id: parsed.fabric_roll_id,
    kind: parsed.kind,
    quantity: parsed.quantity,
    notes: parsed.notes ?? null,
  };
}
