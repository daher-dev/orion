"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/reports/ChartCard";
import { useCostsReport } from "@/hooks/use-reports";
import type { FabricCostRow, ReportDateRange } from "@/lib/schemas/reports";

type Props = { range: ReportDateRange };

const FABRIC_COLORS: Record<FabricCostRow["fabric_type"], string> = {
  jersey: "#c2410c",
  fleece: "#7e5bef",
  french_terry: "#0f766e",
  mesh: "#1e40af",
  rib: "#b45309",
};

/**
 * Costs tab — adapted from the `CostsReport` component in
 * `/docs/design/source/pages/reports-settings.jsx`.
 *
 *  - "Spec costs" — `.tbl` table inside a `.card` (no body padding) with the
 *    design's uppercase 10.5px column heads + 12px ink-2 body.
 *  - "Fabric cost / kg" — vertical bar chart with the design fabric palette.
 */
export function CostsTab({ range }: Props) {
  const t = useTranslations("reports.costs");
  const tCharts = useTranslations("reports.charts");
  const tFabrics = useTranslations("specs.fabricTypes");
  const locale = useLocale();
  const { data, isPending, isError } = useCostsReport(range);

  if (isError) {
    return (
      <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
        {tCharts("loadError")}
      </div>
    );
  }

  const currencyFmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: locale.startsWith("pt") ? "BRL" : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const specCosts = data?.spec_costs ?? [];
  const fabricCosts = (data?.fabric_cost_per_kg ?? []).map((row) => ({
    fabric_type: row.fabric_type,
    label: tFabrics(row.fabric_type),
    avg_cost: row.avg_cost,
  }));

  return (
    <div className="flex flex-col gap-[18px]">
      <ChartCard
        title={t("specCosts")}
        loading={isPending}
        isEmpty={!isPending && specCosts.length === 0}
        emptyMessage={tCharts("empty")}
        pad={false}
        skeletonHeight={260}
      >
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("specCode")}
              </th>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("laborCost")}
              </th>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("trimCost")}
              </th>
              <th className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[18px] py-[10px] text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {specCosts.map((row, idx) => {
              const last = idx === specCosts.length - 1;
              const cellBorder = last
                ? ""
                : "border-b border-[color:var(--orion-line-soft)]";
              return (
                <tr key={row.spec_id} className="hover:bg-[color:var(--orion-bg)]">
                  <td
                    className={`px-[18px] py-[12px] font-mono text-[12px] text-[color:var(--orion-ink)] ${cellBorder}`}
                  >
                    {row.spec_code}
                  </td>
                  <td
                    className={`px-[14px] py-[12px] text-right font-mono text-[12px] tabular-nums text-[color:var(--orion-ink-2)] ${cellBorder}`}
                  >
                    {currencyFmt.format(row.labor_cost)}
                  </td>
                  <td
                    className={`px-[14px] py-[12px] text-right font-mono text-[12px] tabular-nums text-[color:var(--orion-ink-2)] ${cellBorder}`}
                  >
                    {currencyFmt.format(row.trim_cost)}
                  </td>
                  <td
                    className={`px-[18px] py-[12px] text-right font-mono text-[12.5px] font-medium tabular-nums text-[color:var(--orion-ink)] ${cellBorder}`}
                  >
                    {currencyFmt.format(row.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ChartCard>

      <ChartCard
        title={t("fabricCost")}
        loading={isPending}
        isEmpty={!isPending && fabricCosts.length === 0}
        emptyMessage={tCharts("empty")}
        skeletonHeight={260}
      >
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fabricCosts} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
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
              <Bar dataKey="avg_cost" radius={[4, 4, 0, 0]}>
                {fabricCosts.map((row) => (
                  <Cell key={row.fabric_type} fill={FABRIC_COLORS[row.fabric_type]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
