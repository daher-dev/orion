"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/reports/ChartCard";
import { useInventoryReport } from "@/hooks/use-reports";
import type { ReportDateRange } from "@/lib/schemas/reports";

type Props = { range: ReportDateRange };

/**
 * Inventory tab — adapted from the `InventoryReport` component in
 * `/docs/design/source/pages/reports-settings.jsx`.
 *
 *  - "Current stock levels" card — horizontal bar chart using the amber
 *    `--brand-inv` accent, matching the Estoque sub-product brand.
 *  - "Slow movers" — table (`.tbl` parity) inside a `.card` with no body
 *    padding so the table header rule lines up with the card edges.
 */
export function InventoryTab({ range }: Props) {
  const t = useTranslations("reports.inventory");
  const tCharts = useTranslations("reports.charts");
  const { data, isPending, isError } = useInventoryReport(range);

  if (isError) {
    return (
      <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
        {tCharts("loadError")}
      </div>
    );
  }

  // Top-12 stock levels — keep the chart readable.
  const stockLevels = (data?.stock_levels ?? []).slice(0, 12);
  const slowMovers = (data?.slow_movers ?? []).slice(0, 20);

  return (
    <div className="flex flex-col gap-[18px]">
      <ChartCard
        title={t("currentLevels")}
        loading={isPending}
        isEmpty={!isPending && stockLevels.length === 0}
        emptyMessage={tCharts("empty")}
        skeletonHeight={320}
      >
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stockLevels}
              layout="vertical"
              margin={{ top: 8, right: 18, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--orion-line-soft)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--orion-ink-3)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--orion-line)" }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="sku"
                tick={{ fontSize: 11, fill: "var(--orion-ink-2)" }}
                tickLine={false}
                axisLine={false}
                width={108}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--orion-surface)",
                  border: "1px solid var(--orion-line)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="on_hand" fill="var(--brand-inv)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title={t("slowMovers")}
        loading={isPending}
        isEmpty={!isPending && slowMovers.length === 0}
        emptyMessage={tCharts("empty")}
        pad={false}
        skeletonHeight={220}
      >
        {/* .tbl — direct port of the design table: 10.5px / 0.08em uppercase
            ink-3 headers, 13px ink-2 body, line-soft row borders, hover bg. */}
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("sku")}
              </th>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("daysIdle")}
              </th>
            </tr>
          </thead>
          <tbody>
            {slowMovers.map((row, idx) => (
              <tr
                key={row.variation_id}
                className="hover:bg-[color:var(--orion-bg)]"
              >
                <td
                  className={[
                    "px-[18px] py-[12px] font-mono text-[12px] text-[color:var(--orion-ink)]",
                    idx === slowMovers.length - 1
                      ? ""
                      : "border-b border-[color:var(--orion-line-soft)]",
                  ].join(" ")}
                >
                  {row.sku}
                </td>
                <td
                  className={[
                    "px-[18px] py-[12px] text-right font-mono text-[12px] tabular-nums text-[color:var(--orion-ink)]",
                    idx === slowMovers.length - 1
                      ? ""
                      : "border-b border-[color:var(--orion-line-soft)]",
                  ].join(" ")}
                >
                  {row.days_no_movement}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
    </div>
  );
}
