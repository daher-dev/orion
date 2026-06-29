"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/reports/ChartCard";
import { useSalesReport } from "@/hooks/use-reports";
import type {
  ReportDateRange,
  SalesByChannel,
  SalesByStatus,
} from "@/lib/schemas/reports";

type Props = { range: ReportDateRange };

/**
 * Sales tab — direct port of the `SalesReport` component in
 * `/docs/design/source/pages/reports-settings.jsx`.
 *
 *  - 3-column KPI grid (`.kpi` from styles.css): Total revenue, Total orders,
 *    Average ticket. Each KPI uses the design's serif 30px value + 11px
 *    uppercase muted label.
 *  - Card "Revenue by day" — vertical bar chart with the brand-reports accent
 *    fill, matching the gradient bars in `RevenueChart`.
 *  - 2-column row: "Orders by channel" (pie) + "Orders by status" (bar).
 */

/** Brand-aligned palette for the by-channel pie. */
const CHANNEL_COLORS: Record<SalesByChannel["channel"], string> = {
  shopee: "#c2410c", // brand-sales
  mercado_livre: "#eab308",
  shein: "#1f2937",
  tiktok_shop: "#0ea5a4",
  shopify: "#0f766e", // brand-prod (used as a complement)
  instagram: "#7e5bef", // brand-catalog
  whatsapp: "#15803d",
  other: "#a8a29e",
};

const STATUS_COLOR: Record<SalesByStatus["status"], string> = {
  pending: "#b45309",
  paid: "#1e40af",
  shipped: "#1e40af",
  delivered: "#15803d",
  cancelled: "#b91c1c",
  returned: "#a8a29e",
};

export function SalesTab({ range }: Props) {
  const t = useTranslations("reports.sales");
  const tCharts = useTranslations("reports.charts");
  const tChannels = useTranslations("orders.channels");
  const tStatuses = useTranslations("orders.statuses");
  const locale = useLocale();
  const { data, isPending, isError } = useSalesReport(range);

  const currencyFmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: locale.startsWith("pt") ? "BRL" : "USD",
    maximumFractionDigits: 0,
  });
  const intFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  if (isError) {
    return (
      <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
        {tCharts("loadError")}
      </div>
    );
  }

  const byChannel = (data?.by_channel ?? []).map((row) => ({
    channel: row.channel,
    label: tChannels(row.channel),
    count: row.count,
    revenue: row.revenue,
  }));

  const byStatus = (data?.by_status ?? []).map((row) => ({
    status: row.status,
    label: tStatuses(row.status),
    count: row.count,
  }));

  const byDay = (data?.by_day ?? []).map((row) => ({
    day: row.day,
    label: new Date(`${row.day}T00:00:00`).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
    }),
    count: row.count,
    revenue: row.revenue,
  }));

  return (
    // .page > * gap matches the dashboard's 18px vertical stack.
    <div className="flex flex-col gap-[18px]">
      {/* KPI strip — `.grid` `.g-cols-3` from /docs/design/source/styles.css. */}
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile
          label={t("totalRevenue")}
          value={isPending ? null : currencyFmt.format(data?.total_revenue ?? 0)}
        />
        <KpiTile
          label={t("totalOrders")}
          value={isPending ? null : intFmt.format(data?.total_count ?? 0)}
        />
        <KpiTile
          label={t("avgTicket")}
          value={
            isPending
              ? null
              : currencyFmt.format(
                  data?.total_count
                    ? (data?.total_revenue ?? 0) / data.total_count
                    : 0,
                )
          }
        />
      </div>

      {/* Receita por dia — vertical bar chart, brand-reports gradient. */}
      <ChartCard
        title={t("byDay")}
        loading={isPending}
        isEmpty={!isPending && byDay.length === 0}
        emptyMessage={tCharts("empty")}
        skeletonHeight={260}
      >
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDay} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--orion-line-soft)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--orion-ink-3)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--orion-line)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--orion-ink-3)" }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) => currencyFmt.format(Number(value))}
                contentStyle={{
                  background: "var(--orion-surface)",
                  border: "1px solid var(--orion-line)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="revenue"
                fill="var(--brand-reports)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid gap-[18px] lg:grid-cols-2">
        <ChartCard
          title={t("byChannel")}
          loading={isPending}
          isEmpty={!isPending && byChannel.length === 0}
          emptyMessage={tCharts("empty")}
          skeletonHeight={260}
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byChannel}
                  dataKey="revenue"
                  nameKey="label"
                  outerRadius={88}
                  innerRadius={48}
                  paddingAngle={2}
                  stroke="var(--orion-surface)"
                >
                  {byChannel.map((row) => (
                    <Cell key={row.channel} fill={CHANNEL_COLORS[row.channel]} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconType="circle"
                  formatter={(label) => (
                    <span className="text-[11.5px] text-[color:var(--orion-ink-2)]">
                      {label}
                    </span>
                  )}
                />
                <Tooltip
                  formatter={(value) => currencyFmt.format(Number(value))}
                  contentStyle={{
                    background: "var(--orion-surface)",
                    border: "1px solid var(--orion-line)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={t("byStatus")}
          loading={isPending}
          isEmpty={!isPending && byStatus.length === 0}
          emptyMessage={tCharts("empty")}
          skeletonHeight={260}
        >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--orion-line-soft)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--orion-ink-3)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--orion-line)" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--orion-ink-3)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--orion-surface)",
                    border: "1px solid var(--orion-line)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byStatus.map((row) => (
                    <Cell key={row.status} fill={STATUS_COLOR[row.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

/**
 * KPI tile — direct port of `.kpi` from /docs/design/source/styles.css.
 *
 *  - surface bg, 1px line border, 14px radius, 16/18 padding.
 *  - column flex, 8px gap.
 *  - label: 11px uppercase ink-3, weight 600, tracking 0.1em.
 *  - value: Fraunces 30px ink, weight 400, tracking -0.02em, line-height 1.
 */
function KpiTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]">
      <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-[color:var(--orion-ink-3)]">
        {label}
      </span>
      <span className="font-serif text-[30px] font-normal leading-none tracking-[-0.02em] text-[color:var(--orion-ink)]">
        {value ?? "—"}
      </span>
    </div>
  );
}
