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

export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;

export const pipelineCountsSchema = z.object({
  total_pending_orders: z.number(),
  in_cutting: z.number(),
  in_sewing: z.number(),
  in_stock: z.number(),
  shipped_30d: z.number(),
});

export type PipelineCounts = z.infer<typeof pipelineCountsSchema>;

export const needsActionItemSchema = z.object({
  kind: z.string(),
  message: z.string(),
  link: z.string(),
});

export type NeedsActionItem = z.infer<typeof needsActionItemSchema>;

export const activityItemSchema = z.object({
  id: z.string(),
  when: z.string(),
  who: z.string().nullable(),
  message: z.string(),
  resource_type: z.string(),
  resource_id: z.string(),
});

export type ActivityItem = z.infer<typeof activityItemSchema>;

export const channelRevenueSchema = z.object({
  channel: z.string(),
  revenue: z.number(),
});

export type ChannelRevenue = z.infer<typeof channelRevenueSchema>;

export const dashboardSummarySchema = z.object({
  kpis: dashboardKpisSchema,
  pipeline: pipelineCountsSchema,
  needs_action: z.array(needsActionItemSchema),
  activity: z.array(activityItemSchema),
  revenue_by_channel: z.array(channelRevenueSchema),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
