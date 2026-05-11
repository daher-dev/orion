/**
 * Zod schemas for the Reports endpoints (FEATURE-015).
 *
 * Mirrors `backend/src/schemas/reports.py`. Four read-only endpoints, each
 * keyed by an optional `date_from` + `date_to` query pair:
 *   - GET /v1/reports/sales      → SalesReport
 *   - GET /v1/reports/production → ProductionReport
 *   - GET /v1/reports/inventory  → InventoryReport
 *   - GET /v1/reports/costs      → CostsReport
 *
 * Numeric values are wire-serialised as plain floats (no Decimal strings).
 * Counts stay as integers.
 */

import { z } from "zod";
import { ECOMMERCE_CHANNELS } from "@/lib/schemas/ad";
import { ORDER_STATUSES } from "@/lib/schemas/order";
import { FABRIC_TYPES } from "@/lib/schemas/fabric";

// ----------- Sales report -----------

export const salesByChannelSchema = z.object({
  channel: z.enum(ECOMMERCE_CHANNELS),
  count: z.number(),
  revenue: z.number(),
});

export const salesByStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  count: z.number(),
});

export const salesByDaySchema = z.object({
  day: z.string(), // ISO date (YYYY-MM-DD)
  count: z.number(),
  revenue: z.number(),
});

export const salesReportSchema = z.object({
  by_channel: z.array(salesByChannelSchema),
  by_status: z.array(salesByStatusSchema),
  by_day: z.array(salesByDaySchema),
  total_count: z.number(),
  total_revenue: z.number(),
});

export type SalesByChannel = z.infer<typeof salesByChannelSchema>;
export type SalesByStatus = z.infer<typeof salesByStatusSchema>;
export type SalesByDay = z.infer<typeof salesByDaySchema>;
export type SalesReport = z.infer<typeof salesReportSchema>;

// ----------- Production report -----------

export const cuttingThroughputPointSchema = z.object({
  day: z.string(),
  pieces_cut: z.number(),
});

export const sewingThroughputPointSchema = z.object({
  day: z.string(),
  pieces_received: z.number(),
});

export const productionReportSchema = z.object({
  cutting_throughput: z.array(cuttingThroughputPointSchema),
  sewing_throughput: z.array(sewingThroughputPointSchema),
  scrap_pct: z.number(),
});

export type CuttingThroughputPoint = z.infer<typeof cuttingThroughputPointSchema>;
export type SewingThroughputPoint = z.infer<typeof sewingThroughputPointSchema>;
export type ProductionReport = z.infer<typeof productionReportSchema>;

// ----------- Inventory report -----------

export const inventoryLevelSchema = z.object({
  variation_id: z.string(),
  sku: z.string(),
  on_hand: z.number(),
});

export const slowMoverSchema = z.object({
  variation_id: z.string(),
  sku: z.string(),
  days_no_movement: z.number(),
});

export const inventoryReportSchema = z.object({
  stock_levels: z.array(inventoryLevelSchema),
  slow_movers: z.array(slowMoverSchema),
});

export type InventoryLevel = z.infer<typeof inventoryLevelSchema>;
export type SlowMover = z.infer<typeof slowMoverSchema>;
export type InventoryReport = z.infer<typeof inventoryReportSchema>;

// ----------- Costs report -----------

export const specCostRowSchema = z.object({
  spec_id: z.string(),
  spec_code: z.string(),
  labor_cost: z.number(),
  trim_cost: z.number(),
  total: z.number(),
});

export const fabricCostRowSchema = z.object({
  fabric_type: z.enum(FABRIC_TYPES),
  avg_cost: z.number(),
});

export const costsReportSchema = z.object({
  spec_costs: z.array(specCostRowSchema),
  fabric_cost_per_kg: z.array(fabricCostRowSchema),
});

export type SpecCostRow = z.infer<typeof specCostRowSchema>;
export type FabricCostRow = z.infer<typeof fabricCostRowSchema>;
export type CostsReport = z.infer<typeof costsReportSchema>;

// ----------- Date range helpers -----------

/**
 * Date range filter passed to every report endpoint. Both bounds are
 * optional and ISO-encoded (`YYYY-MM-DD`). The backend reads them as
 * `datetime` query params; a YYYY-MM-DD string is parsed as the start
 * of that day in UTC, which is what the consumers want for inclusive
 * day-level windows.
 */
export type ReportDateRange = {
  date_from?: string;
  date_to?: string;
};
