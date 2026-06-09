import { z } from "zod";

/** Default low-stock threshold used as the client-side fallback. Mirrors the
 *  backend ``DEFAULT_LOW_STOCK_THRESHOLD`` (and the companies column default). */
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

/** Sane upper bound, matching the backend ``MAX_LOW_STOCK_THRESHOLD``. */
export const MAX_LOW_STOCK_THRESHOLD = 1_000_000;

export const stockSettingsReadSchema = z.object({
  low_stock_threshold: z.number().int().nonnegative(),
});

export const stockSettingsUpdateSchema = z.object({
  low_stock_threshold: z
    .number()
    .int()
    .min(0)
    .max(MAX_LOW_STOCK_THRESHOLD),
});

export type StockSettingsRead = z.infer<typeof stockSettingsReadSchema>;
export type StockSettingsUpdate = z.infer<typeof stockSettingsUpdateSchema>;
