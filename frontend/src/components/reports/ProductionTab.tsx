"use client";

import { useLocale, useTranslations } from "next-intl";
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
import { useProductionReport } from "@/hooks/use-reports";
import type { ReportDateRange } from "@/lib/schemas/reports";

type Props = { range: ReportDateRange };

/**
 * Production tab — direct port of the `ProductionReport` component in
 * `/docs/design/source/pages/reports-settings.jsx`.
 *
 *  - KPI strip: Scrap rate + Pieces per day.
 *  - 2-column body: Cutting throughput + Sewing throughput.
 *  - Bars use the `--brand-prod` (teal) accent — keeps the page consistent
 *    with the Production section's brand color even though we're on the
 *    Reports page (whose brand is `--brand-reports`).
 */
export function ProductionTab({ range }: Props) {
  const t = useTranslations("reports.production");
  const tCharts = useTranslations("reports.charts");
  const locale = useLocale();
  const { data, isPending, isError } = useProductionReport(range);

  if (isError) {
    return (
      <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
        {tCharts("loadError")}
      </div>
    );
  }

  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  const cutting = (data?.cutting_throughput ?? []).map((row) => ({
    label: fmtDay(row.day),
    pieces: row.pieces_cut,
  }));
  const sewing = (data?.sewing_throughput ?? []).map((row) => ({
    label: fmtDay(row.day),
    pieces: row.pieces_received,
  }));

  const scrapPct = data?.scrap_pct ?? 0;
  const scrapLabel = isPending
    ? "—"
    : `${scrapPct.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <KpiTile label={t("scrapPct")} value={scrapLabel} />
        <KpiTile
          label={t("piecesPerDay")}
          value={
            isPending
              ? "—"
              : (cutting.reduce((acc, r) => acc + r.pieces, 0) || 0).toLocaleString(locale)
          }
        />
      </div>

      <div className="grid gap-[18px] lg:grid-cols-2">
        <ChartCard
          title={t("cuttingThroughput")}
          loading={isPending}
          isEmpty={!isPending && cutting.length === 0}
          emptyMessage={tCharts("empty")}
          skeletonHeight={260}
        >
          <ThroughputChart data={cutting} fill="var(--brand-prod)" />
        </ChartCard>

        <ChartCard
          title={t("sewingThroughput")}
          loading={isPending}
          isEmpty={!isPending && sewing.length === 0}
          emptyMessage={tCharts("empty")}
          skeletonHeight={260}
        >
          <ThroughputChart data={sewing} fill="var(--brand-reports)" />
        </ChartCard>
      </div>
    </div>
  );
}

function ThroughputChart({
  data,
  fill,
}: {
  data: { label: string; pieces: number }[];
  fill: string;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
          <Bar dataKey="pieces" fill={fill} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * KPI tile — direct port of `.kpi` from /docs/design/source/styles.css.
 * Same shape as `SalesTab.KpiTile`; kept colocated to avoid premature
 * cross-tab coupling.
 */
function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]">
      <span className="text-[11px] font-semibold uppercase leading-none tracking-[0.1em] text-[color:var(--orion-ink-3)]">
        {label}
      </span>
      <span className="font-serif text-[30px] font-normal leading-none tracking-[-0.02em] text-[color:var(--orion-ink)]">
        {value}
      </span>
    </div>
  );
}
