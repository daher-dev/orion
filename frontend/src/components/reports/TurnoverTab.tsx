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
import { useTurnoverReport } from "@/hooks/use-reports";
import type { ReportDateRange } from "@/lib/schemas/reports";

type Props = { range: ReportDateRange };

/**
 * Turnover ("giro") tab — inventory velocity per SKU over the date range.
 * Modeled on {@link InventoryTab}:
 *
 *  - A "velocity" card with a horizontal bar chart of `turnover_ratio`
 *    (units sold / average on-hand) using the amber `--brand-inv` accent.
 *  - A `.tbl`-parity table with per-SKU columns: SKU, units sold, avg on-hand,
 *    turnover ratio, and days-inventory-outstanding (DIO). DIO is `null` when
 *    there is no turnover, rendered as an em-dash.
 */
export function TurnoverTab({ range }: Props) {
  const t = useTranslations("reports.turnover");
  const tCharts = useTranslations("reports.charts");
  const { data, isPending, isError } = useTurnoverReport(range);

  if (isError) {
    return (
      <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
        {tCharts("loadError")}
      </div>
    );
  }

  const rows = data?.rows ?? [];
  // Top-12 by turnover keeps the chart readable (rows arrive sorted desc).
  const chartRows = rows.slice(0, 12);

  return (
    <div className="flex flex-col gap-[18px]">
      <ChartCard
        title={t("velocity")}
        loading={isPending}
        isEmpty={!isPending && chartRows.length === 0}
        emptyMessage={tCharts("empty")}
        skeletonHeight={320}
      >
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 8, right: 18, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--orion-line-soft)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--orion-ink-3)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--orion-line)" }}
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
              <Bar dataKey="turnover_ratio" fill="var(--brand-inv)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title={t("perSku")}
        loading={isPending}
        isEmpty={!isPending && rows.length === 0}
        emptyMessage={tCharts("empty")}
        pad={false}
        skeletonHeight={220}
      >
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("sku")}
              </th>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("unitsSold")}
              </th>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("avgOnHand")}
              </th>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("turnoverRatio")}
              </th>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("dio")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const last = idx === rows.length - 1;
              const cellBorder = last ? "" : "border-b border-[color:var(--orion-line-soft)]";
              return (
                <tr key={row.variation_id} className="hover:bg-[color:var(--orion-bg)]">
                  <td className={`px-[18px] py-[12px] font-mono text-[12px] text-[color:var(--orion-ink)] ${cellBorder}`}>
                    {row.sku}
                  </td>
                  <td className={`px-[18px] py-[12px] text-right font-mono text-[12px] tabular-nums text-[color:var(--orion-ink)] ${cellBorder}`}>
                    {row.units_sold}
                  </td>
                  <td className={`px-[18px] py-[12px] text-right font-mono text-[12px] tabular-nums text-[color:var(--orion-ink)] ${cellBorder}`}>
                    {row.average_on_hand}
                  </td>
                  <td className={`px-[18px] py-[12px] text-right font-mono text-[12px] tabular-nums text-[color:var(--orion-ink)] ${cellBorder}`}>
                    {row.turnover_ratio.toFixed(2)}
                  </td>
                  <td className={`px-[18px] py-[12px] text-right font-mono text-[12px] tabular-nums text-[color:var(--orion-ink)] ${cellBorder}`}>
                    {row.days_inventory_outstanding === null
                      ? "—"
                      : row.days_inventory_outstanding.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ChartCard>
    </div>
  );
}
