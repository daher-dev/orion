import { z } from "zod";

// Mirrors backend/src/schemas/dashboard.py — the conference-centred panorama
// returned by GET /v1/dashboard/summary.

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

// ---------- Top 5 produtos (by pieces in the order book) ----------

export const topProductSchema = z.object({
  product_id: z.string(),
  code: z.string(),
  name: z.string(),
  pieces: z.number().int(),
  orders: z.number().int(),
});

export type TopProduct = z.infer<typeof topProductSchema>;

// ---------- Conferência (orders → pieces fulfillment summary) ----------

export const conferenceTotalsSchema = z.object({
  orders: z.number().int(),
  pieces: z.number().int(),
  mapped: z.number().int(),
  pending: z.number().int(),
  mapped_pct: z.number().int(),
  in_lote: z.number().int(),
  // Order-level checked classification (the three sum to `orders`).
  orders_checked: z.number().int(),
  orders_partial: z.number().int(),
  orders_untouched: z.number().int(),
  // Piece-level checked count (drives "Peças conferidas").
  pieces_checked: z.number().int(),
});

export type ConferenceTotals = z.infer<typeof conferenceTotalsSchema>;

export const conferenceSummarySchema = z.object({
  totals: conferenceTotalsSchema,
});

export type ConferenceSummary = z.infer<typeof conferenceSummarySchema>;

// ---------- Operator (factory-floor) section ----------

export const operatorCutSchema = z.object({
  id: z.string(),
  code: z.string(),
  color: z.string(),
  status: z.string(), // CuttingStatus value ("pending" | "cutting")
});

export type OperatorCut = z.infer<typeof operatorCutSchema>;

export const operatorSummarySchema = z.object({
  cuts_in_queue: z.number().int(),
  shipments_incoming: z.number().int(),
  pieces_today: z.number().int(),
  cutting_queue: z.array(operatorCutSchema),
});

export type OperatorSummary = z.infer<typeof operatorSummarySchema>;

// ---------- Composite payload ----------

export const dashboardSummarySchema = z.object({
  conference: conferenceSummarySchema,
  top_products: z.array(topProductSchema),
  needs_action: z.array(needsActionItemSchema),
  activity: z.array(activityItemSchema),
  operator: operatorSummarySchema,
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
