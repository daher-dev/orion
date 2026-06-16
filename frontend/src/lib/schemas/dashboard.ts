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

// ---------- Conferência (orders → pieces fulfillment summary) ----------

export const conferenceTotalsSchema = z.object({
  orders: z.number().int(),
  pieces: z.number().int(),
  mapped: z.number().int(),
  pending: z.number().int(),
  checked: z.number().int(),
  to_check: z.number().int(),
  in_lote: z.number().int(),
  mapped_pct: z.number().int(),
});

export type ConferenceTotals = z.infer<typeof conferenceTotalsSchema>;

export const conferencePipelineSchema = z.object({
  mapeamento: z.number().int(),
  producao: z.number().int(),
  separacao: z.number().int(),
  envio: z.number().int(),
});

export type ConferencePipeline = z.infer<typeof conferencePipelineSchema>;

export const conferenceBatchCountsSchema = z.object({
  open: z.number().int(),
  in_production: z.number().int(),
  dispatched: z.number().int(),
});

export type ConferenceBatchCounts = z.infer<typeof conferenceBatchCountsSchema>;

export const conferenceSummarySchema = z.object({
  totals: conferenceTotalsSchema,
  pipeline: conferencePipelineSchema,
  batches: conferenceBatchCountsSchema,
});

export type ConferenceSummary = z.infer<typeof conferenceSummarySchema>;

export const dashboardSummarySchema = z.object({
  kpis: dashboardKpisSchema,
  pipeline: pipelineCountsSchema,
  needs_action: z.array(needsActionItemSchema),
  activity: z.array(activityItemSchema),
  revenue_by_channel: z.array(channelRevenueSchema),
  conference: conferenceSummarySchema,
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
