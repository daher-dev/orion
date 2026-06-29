/**
 * Zod schemas for the Upseller order import.
 *
 * Mirrors `backend/src/schemas/imported_orders.py`. One-shot contract:
 *
 *   POST /v1/orders/import/upseller — multipart upload (the .csv exported
 *   from Upseller) plus a `dry_run` flag. Returns an
 *   `UpsellerImportSummary`: the line counts plus a per-row `errors` list
 *   for lines that could not be strict-matched against the tenant catalog
 *   (with the reason, platform order id and SKU). `dry_run=true` previews
 *   without writing — the UI runs a dry-run first, then commits the same file.
 */

import { z } from "zod";

import { ecommerceSchema } from "@/lib/schemas/ad";

/**
 * One source line that could not be matched + persisted, with the reason.
 *
 * Carries enough of the raw line (channel, SKU, ad title, variation text,
 * image) for the in-import resolver to render it and let an operator pin the
 * right ad + variation — persisted as a SKU mapping the importer then reuses.
 */
export const upsellerImportErrorSchema = z.object({
  row_index: z.number().int().min(0),
  message: z.string(),
  marketplace: ecommerceSchema.nullable().optional(),
  platform_order_id: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  ad_title: z.string().nullable().optional(),
  variation_text: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

export type UpsellerImportError = z.infer<typeof upsellerImportErrorSchema>;

/** Pin a marketplace SKU → ad + variation (the persistent De/Para). */
export const skuMappingCreateSchema = z.object({
  marketplace: ecommerceSchema,
  sku: z.string().min(1).max(120),
  ad_id: z.string().min(1),
  variation_id: z.string().min(1),
});

export type SkuMappingCreate = z.infer<typeof skuMappingCreateSchema>;

/** A stored De/Para entry, enriched with the resolved catalog context. */
export const skuMappingReadSchema = z.object({
  id: z.string(),
  marketplace: ecommerceSchema,
  sku: z.string(),
  ad_id: z.string(),
  variation_id: z.string(),
  source: z.string(),
  created_at: z.string(),
  ad_title: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
  variation_sku: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
});

export type SkuMappingRead = z.infer<typeof skuMappingReadSchema>;

/** Outcome of an import run (or a dry-run preview). */
export const upsellerImportSummarySchema = z.object({
  total: z.number().int().min(0),
  created: z.number().int().min(0),
  skipped_duplicates: z.number().int().min(0),
  errors: z.array(upsellerImportErrorSchema),
  dry_run: z.boolean(),
});

export type UpsellerImportSummary = z.infer<typeof upsellerImportSummarySchema>;

/** Max upload size honored by the backend import endpoint (5 MB). */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Accepted upload extensions / MIME types — the Upseller export is a CSV. */
export const ACCEPTED_UPLOAD_EXTENSIONS = [".csv"] as const;
export const ACCEPTED_UPLOAD_MIMES = [
  "text/csv",
  "application/vnd.ms-excel", // some browsers tag .csv as this
] as const;

/** True if the File looks like an accepted CSV (by extension or MIME). */
export function isAcceptedUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  if (ACCEPTED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return (ACCEPTED_UPLOAD_MIMES as readonly string[]).includes(file.type);
}
