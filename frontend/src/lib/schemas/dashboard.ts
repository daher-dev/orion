import { z } from "zod";

export const kpiSchema = z.object({
  label: z.string(),
  value: z.number(),
  delta_pct: z.number().nullable(),
  sparkline: z.array(z.number()).nullable(),
});

export type Kpi = z.infer<typeof kpiSchema>;

export const dashboardKpisSchema = z.object({
  orders_pending: kpiSchema,
  orders_revenue_30d: kpiSchema,
  cutting_pending: kpiSchema,
  stock_low: kpiSchema,
  banca_active: kpiSchema,
});

export const pipelineCountsSchema = z.object({
  total_pending_orders: z.number(),
  in_cutting: z.number(),
  in_sewing: z.number(),
  in_stock: z.number(),
  shipped_30d: z.number(),
});

export const needsActionItemSchema = z.object({
  kind: z.string(),
  message: z.string(),
  link: z.string(),
});

export const activityItemSchema = z.object({
  id: z.string(),
  when: z.string(),
  who: z.string().nullable(),
  message: z.string(),
  resource_type: z.string(),
  resource_id: z.string(),
});

export const dashboardSummarySchema = z.object({
  kpis: dashboardKpisSchema,
  pipeline: pipelineCountsSchema,
  needs_action: z.array(needsActionItemSchema),
  activity: z.array(activityItemSchema),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
