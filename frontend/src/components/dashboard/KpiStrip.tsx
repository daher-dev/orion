"use client";

import { useTranslations } from "next-intl";
import { KpiCard } from "@/components/dashboard/KpiCard";
import type { DashboardKpis } from "@/lib/schemas/dashboard";

type Props = { kpis: DashboardKpis };

/**
 * 5-card horizontal KPI strip. Each card maps to a sub-product accent so
 * the dashboard reads as a panorama of all sections.
 *
 * Direct port of the `.grid.g-cols-5` block in
 * /docs/design/source/pages/dashboard.jsx — 14px gap, 5 equal columns at
 * desktop with the `.g-cols-5` breakpoint behaviour: collapses to 2 columns
 * around tablet and 1 column on mobile.
 */
export function KpiStrip({ kpis }: Props) {
  const t = useTranslations("dashboard.kpis");

  return (
    // .grid + .g-cols-5: 14px gap, 5 equal columns. The design's
    // `style={{ marginBottom: 18 }}` is applied by the parent page stack.
    // Order + accent colors mirror the design source (dashboard.jsx, line 44):
    //   pending(sales) · cutting(prod) · sewing(prod) · stock(inv) · revenue(accent).
    <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard kpi={{ ...kpis.orders_pending, label: t("ordersPending") }} accent="var(--brand-sales)" />
      <KpiCard kpi={{ ...kpis.cutting_pending, label: t("cuttingPending") }} accent="var(--brand-prod)" />
      <KpiCard kpi={{ ...kpis.banca_active, label: t("bancaActive") }} accent="var(--brand-prod)" />
      <KpiCard kpi={{ ...kpis.stock_low, label: t("stockLow") }} accent="var(--brand-inv)" />
      <KpiCard
        kpi={{ ...kpis.orders_revenue_30d, label: t("ordersRevenue") }}
        accent="var(--sidebar-primary)"
        format="currency"
      />
    </div>
  );
}
