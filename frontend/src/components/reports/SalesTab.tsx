"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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

/** Brand-aligned palette for the by-channel pie. */
const CHANNEL_COLORS: Record<SalesByChannel["channel"], string> = {
  shopee: "#c2410c", // brand-sales
  mercado_livre: "#eab308",
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
      <div className="rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
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
    <div className="flex flex-col gap-4">
      {/* KPI strip — total revenue + total orders, same shape as the dashboard's `.kpi-card`. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiTile
          label={t("totalRevenue")}
          value={isPending ? null : currencyFmt.format(data?.total_revenue ?? 0)}
        />
        <KpiTile
          label={t("totalOrders")}
          value={isPending ? null : intFmt.format(data?.total_count ?? 0)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
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
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {byStatus.map((row) => (
                    <Cell key={row.status} fill={STATUS_COLOR[row.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title={t("byDay")}
        loading={isPending}
        isEmpty={!isPending && byDay.length === 0}
        emptyMessage={tCharts("empty")}
        skeletonHeight={300}
      >
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDay} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
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
                formatter={(value, key) => {
                  const n = Number(value);
                  return key === "revenue" ? currencyFmt.format(n) : intFmt.format(n);
                }}
                contentStyle={{
                  background: "var(--orion-surface)",
                  border: "1px solid var(--orion-line)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--brand-reports)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {label}
      </span>
      <span className="font-serif text-[28px] font-normal leading-none tracking-[-0.02em] text-[color:var(--orion-ink)]">
        {value ?? "—"}
      </span>
    </div>
  );
}
