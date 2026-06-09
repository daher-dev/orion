/**
 * TypeScript types for the Licensing / Billing domain.
 * Mirrors the Pydantic shapes in `backend/src/schemas/billing.py`.
 *
 * Money: the backend already converts cents → reais, so `price` is a number in
 * the major unit (BRL) ready for `fmtBRL`. Monthly limits are `number | null`
 * where `null` means unlimited.
 */

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "paused",
  "cancelled",
  "free",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** A usage dimension measured against the active plan's limit. */
export type UsageMetricKey = "members" | "orders_month" | "integrations" | "storage";

export type UsageMetric = {
  key: UsageMetricKey;
  used: number;
  /** `null` means unlimited. */
  limit: number | null;
  /** `false` means Orion doesn't model this dimension yet (render "not tracked"). */
  tracked: boolean;
};

export type PlanRead = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  /** Major unit (reais), already converted from price_cents. */
  price: number;
  currency: string;
  max_members: number | null;
  max_orders_per_month: number | null;
  max_integrations: number | null;
  max_storage_gb: number | null;
  is_public: boolean;
  sort_order: number;
  active: boolean;
};

export type PlanList = { items: PlanRead[]; total: number };

export type SubscriptionRead = {
  status: SubscriptionStatus;
  period_start: string | null;
  period_end: string | null;
  cancel_at: string | null;
  persisted: boolean;
};

export type InvoiceStub = {
  id: string;
  period: string;
  amount: number;
  currency: string;
  status: string;
};

export type BillingSummary = {
  plan: PlanRead;
  subscription: SubscriptionRead;
  usage: UsageMetric[];
  invoices: InvoiceStub[];
};
