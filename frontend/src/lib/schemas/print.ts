/**
 * Zod schemas for the Prints (estampas) feature.
 * Mirrors backend/src/schemas/print_design.py.
 *
 * `cost_per_unit` is a decimal on the wire — kept as a string in the form
 * layer to avoid input cursor jumps, then validated as a non-negative
 * numeric before submission.
 */

import { z } from "zod";

export const PRINT_TECHNIQUES = ["dtf", "silkscreen", "sublimation"] as const;
export type PrintTechnique = (typeof PRINT_TECHNIQUES)[number];
export const printTechniqueSchema = z.enum(PRINT_TECHNIQUES);

/** Server-derived: `ok` once the matching `*_file_url` is non-null, else `pending`. */
export const ARTWORK_STATUSES = ["ok", "pending"] as const;
export type ArtworkStatus = (typeof ARTWORK_STATUSES)[number];
export const artworkStatusSchema = z.enum(ARTWORK_STATUSES);

/** Garment side an artwork PNG is printed on. */
export const PRINT_SIDES = ["front", "back"] as const;
export type PrintSide = (typeof PRINT_SIDES)[number];
export const printSideSchema = z.enum(PRINT_SIDES);

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** A color variation of an estampa, with a per-side PNG + status. */
export const printVariationSchema = z.object({
  id: z.string(),
  print_design_id: z.string(),
  name: z.string(),
  ink_hex: z.string(),
  front_file_url: z.string().nullable(),
  front_status: artworkStatusSchema,
  back_file_url: z.string().nullable(),
  back_status: artworkStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type PrintVariation = z.infer<typeof printVariationSchema>;

export const printVariationCreateSchema = z.object({
  name: z.string().trim().min(1, { message: "validation.required" }).max(80),
  ink_hex: z.string().regex(HEX_RE, { message: "validation.hex" }),
  front_file_url: z.string().max(500).nullable().optional(),
  back_file_url: z.string().max(500).nullable().optional(),
});

export type PrintVariationCreatePayload = z.infer<typeof printVariationCreateSchema>;

export const printVariationUpdateSchema = printVariationCreateSchema.partial();

export type PrintVariationUpdatePayload = z.infer<typeof printVariationUpdateSchema>;

export const printReadSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  code: z.string(),
  name: z.string(),
  image_url: z.string().nullable(),
  cost_per_unit: z.string(),
  technique: printTechniqueSchema,
  tag: z.string().nullable().optional(),
  has_front: z.boolean(),
  has_back: z.boolean(),
  image_url_front: z.string().nullable().optional(),
  image_url_back: z.string().nullable().optional(),
  width_cm: z.string().nullable().optional(),
  height_cm: z.string().nullable().optional(),
  variations: z.array(printVariationSchema).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Print = z.infer<typeof printReadSchema>;

export const printPageSchema = z.object({
  items: z.array(printReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type PrintPage = z.infer<typeof printPageSchema>;

export type PrintFilters = {
  q?: string;
  page?: number;
  page_size?: number;
};

const decimalString = z
  .string()
  .trim()
  .min(1, { message: "validation.required" })
  .refine((value) => /^\d+(\.\d+)?$/.test(value) || /^\d+,\d+$/.test(value), {
    message: "validation.numeric",
  })
  .transform((value) => value.replace(",", "."));

const optionalUrl = z
  .string()
  .trim()
  .max(512)
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalDecimal = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value.replace(",", ".") : undefined))
  .refine((value) => value === undefined || /^\d+(\.\d+)?$/.test(value), {
    message: "validation.numeric",
  });

export const printFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { message: "validation.codeRequired" })
    .max(32),
  name: z
    .string()
    .trim()
    .min(1, { message: "validation.nameRequired" })
    .max(120),
  image_url: optionalUrl,
  cost_per_unit: decimalString,
  technique: printTechniqueSchema,
  tag: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((value) => (value ? value : undefined)),
  has_front: z.boolean(),
  has_back: z.boolean(),
  image_url_front: optionalUrl,
  image_url_back: optionalUrl,
  width_cm: optionalDecimal,
  height_cm: optionalDecimal,
});

export type PrintFormValues = z.input<typeof printFormSchema>;
export type PrintFormPayload = z.output<typeof printFormSchema>;
