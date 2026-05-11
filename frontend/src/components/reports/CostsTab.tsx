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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export function CostsTab({ range }: Props) {
  const t = useTranslations("reports.costs");
  const tCharts = useTranslations("reports.charts");
  const tFabrics = useTranslations("specs.fabricTypes");
  const locale = useLocale();
  const { data, isPending, isError } = useCostsReport(range);

  if (isError) {
    return (
      <div className="rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
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
    <div className="flex flex-col gap-4">
      <ChartCard
        title={t("specCosts")}
        loading={isPending}
        isEmpty={!isPending && specCosts.length === 0}
        emptyMessage={tCharts("empty")}
        pad={false}
        skeletonHeight={260}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-[18px]">{t("specCode")}</TableHead>
              <TableHead className="text-right">{t("laborCost")}</TableHead>
              <TableHead className="text-right">{t("trimCost")}</TableHead>
              <TableHead className="px-[18px] text-right">{t("total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {specCosts.map((row) => (
              <TableRow key={row.spec_id}>
                <TableCell className="px-[18px] font-mono text-[12.5px] text-[color:var(--orion-ink)]">
                  {row.spec_code}
                </TableCell>
                <TableCell className="text-right font-mono text-[12.5px] tabular-nums text-[color:var(--orion-ink)]">
                  {currencyFmt.format(row.labor_cost)}
                </TableCell>
                <TableCell className="text-right font-mono text-[12.5px] tabular-nums text-[color:var(--orion-ink)]">
                  {currencyFmt.format(row.trim_cost)}
                </TableCell>
                <TableCell className="px-[18px] text-right font-mono text-[13px] font-medium tabular-nums text-[color:var(--orion-ink)]">
                  {currencyFmt.format(row.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
              <Bar dataKey="avg_cost" radius={[6, 6, 0, 0]}>
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
