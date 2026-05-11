"use client";

import { useTranslations } from "next-intl";
import { KpiCard } from "@/components/dashboard/KpiCard";
import type { DashboardKpis } from "@/lib/schemas/dashboard";

type Props = { kpis: DashboardKpis };

/**
 * 5-card horizontal KPI strip. Each card maps to a sub-product accent so
 * the dashboard reads as a panorama of all sections.
 */
export function KpiStrip({ kpis }: Props) {
  const t = useTranslations("dashboard.kpis");

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard kpi={{ ...kpis.orders_pending, label: t("ordersPending") }} accent="var(--brand-sales)" />
      <KpiCard kpi={{ ...kpis.orders_revenue_30d, label: t("ordersRevenue") }} accent="var(--brand-sales)" format="currency" />
      <KpiCard kpi={{ ...kpis.cutting_pending, label: t("cuttingPending") }} accent="var(--brand-prod)" />
      <KpiCard kpi={{ ...kpis.stock_low, label: t("stockLow") }} accent="var(--brand-inv)" />
      <KpiCard kpi={{ ...kpis.banca_active, label: t("bancaActive") }} accent="var(--brand-prod)" />
    </div>
  );
}
