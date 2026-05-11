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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInventoryReport } from "@/hooks/use-reports";
import type { ReportDateRange } from "@/lib/schemas/reports";

type Props = { range: ReportDateRange };

export function InventoryTab({ range }: Props) {
  const t = useTranslations("reports.inventory");
  const tCharts = useTranslations("reports.charts");
  const { data, isPending, isError } = useInventoryReport(range);

  if (isError) {
    return (
      <div className="rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
        {tCharts("loadError")}
      </div>
    );
  }

  // Top-12 stock levels — keep the chart readable.
  const stockLevels = (data?.stock_levels ?? []).slice(0, 12);
  const slowMovers = (data?.slow_movers ?? []).slice(0, 20);

  return (
    <div className="flex flex-col gap-4">
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
              <Bar dataKey="on_hand" fill="var(--brand-inv)" radius={[0, 6, 6, 0]} />
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-[18px]">{t("sku")}</TableHead>
              <TableHead className="text-right">{t("daysIdle")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slowMovers.map((row) => (
              <TableRow key={row.variation_id}>
                <TableCell className="px-[18px] font-mono text-[12.5px] text-[color:var(--orion-ink)]">
                  {row.sku}
                </TableCell>
                <TableCell className="text-right font-mono text-[12.5px] tabular-nums text-[color:var(--orion-ink)]">
                  {row.days_no_movement}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ChartCard>
    </div>
  );
}
