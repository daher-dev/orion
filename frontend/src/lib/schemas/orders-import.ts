/**
 * Zod schemas for FEATURE-014 — Sales Orders Import.
 *
 * Mirrors `backend/src/schemas/orders_import.py`. The two-step contract:
 *
 *  1. POST /v1/orders/import/parse — multipart upload (.pdf or .csv).
 *     Returns a `ParseResponse` carrying a list of `ParsedOrderRow`
 *     (one per detected order) plus an optional `notes` string with
 *     the parser's own commentary (e.g. "the receipt is dated in BRT").
 *  2. POST /v1/orders/import/commit — JSON body with the (potentially
 *     user-edited) rows. Returns a `CommitOrdersResponse` with the
 *     `created` count and a per-row `errors` array keyed by
 *     `row_index` so the UI can surface partial failures inline.
 *
 * `confidence` is a float in [0, 1]. Decimal fields come down the wire
 * as strings (FastAPI serialises Decimals that way); we accept either
 * a string or a number on input to be lenient.
 */

import { z } from "zod";

/** Confidence buckets used by the UI pill. */
export const CONFIDENCE_BUCKETS = ["high", "medium", "low", "none"] as const;
export type ConfidenceBucket = (typeof CONFIDENCE_BUCKETS)[number];

/** Map a 0..1 score to a UI bucket. Mirrors the design pill tones. */
export function confidenceBucket(score: number | null | undefined): ConfidenceBucket {
  if (score == null || Number.isNaN(score)) return "none";
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.01) return "low";
  return "none";
}

/** Format a 0..1 score as a percentage (rounded to nearest integer). */
export function formatConfidence(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "—";
  const pct = Math.round(score * 100);
  return `${pct}%`;
}

/**
 * One review row as returned by /parse and fed back to /commit.
 *
 * Mirrors `ParsedOrderRow` on the backend. Decimal serialises as a
 * string in JSON; we accept either to make the parser forgiving.
 */
export const parsedOrderRowSchema = z.object({
  row_index: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  client_name: z.string().max(120).nullable().optional(),
  client_email: z.string().max(255).nullable().optional(),
  client_phone: z.string().max(40).nullable().optional(),
  ad_external_id: z.string().max(120).nullable().optional(),
  product_hint: z.string().max(200).nullable().optional(),
  quantity: z.number().int().min(1).nullable().optional(),
  // The backend uses Decimal — FastAPI emits it as a string.
  sale_price: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v.toFixed(2) : v))
    .nullable()
    .optional(),
  ordered_at: z.string().nullable().optional(),
  raw_excerpt: z.string().max(500).nullable().optional(),
});

export type ParsedOrderRow = z.infer<typeof parsedOrderRowSchema>;

export const parseResponseSchema = z.object({
  rows: z.array(parsedOrderRowSchema),
  notes: z.string().nullable().optional(),
});

export type ParseResponse = z.infer<typeof parseResponseSchema>;

export const commitOrdersBodySchema = z.object({
  rows: z.array(parsedOrderRowSchema).min(1),
});

export type CommitOrdersBody = z.infer<typeof commitOrdersBodySchema>;

export const commitOrderErrorSchema = z.object({
  row_index: z.number().int().min(0),
  message: z.string(),
});

export type CommitOrderError = z.infer<typeof commitOrderErrorSchema>;

export const commitOrdersResponseSchema = z.object({
  created: z.number().int().min(0),
  errors: z.array(commitOrderErrorSchema),
});

export type CommitOrdersResponse = z.infer<typeof commitOrdersResponseSchema>;

/** Editable columns in the preview table. */
export const EDITABLE_FIELDS = [
  "client_name",
  "client_email",
  "client_phone",
  "ad_external_id",
  "product_hint",
  "quantity",
  "sale_price",
  "ordered_at",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** Max upload size honored by the backend parse endpoint (5 MB). */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Accepted upload extensions / MIME types. */
export const ACCEPTED_UPLOAD_EXTENSIONS = [".pdf", ".csv"] as const;
export const ACCEPTED_UPLOAD_MIMES = [
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel", // some browsers tag .csv as this
] as const;

/** True if the File matches one of the accepted PDF / CSV signatures. */
export function isAcceptedUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  if (ACCEPTED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return (ACCEPTED_UPLOAD_MIMES as readonly string[]).includes(file.type);
}
