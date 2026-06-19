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

/** One source line that could not be matched + persisted, with the reason. */
export const upsellerImportErrorSchema = z.object({
  row_index: z.number().int().min(0),
  message: z.string(),
  platform_order_id: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
});

export type UpsellerImportError = z.infer<typeof upsellerImportErrorSchema>;

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
