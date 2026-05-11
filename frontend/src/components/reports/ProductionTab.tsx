"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/reports/ChartCard";
import { useProductionReport } from "@/hooks/use-reports";
import type { ReportDateRange } from "@/lib/schemas/reports";

type Props = { range: ReportDateRange };

export function ProductionTab({ range }: Props) {
  const t = useTranslations("reports.production");
  const tCharts = useTranslations("reports.charts");
  const locale = useLocale();
  const { data, isPending, isError } = useProductionReport(range);

  if (isError) {
    return (
      <div className="rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
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
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiTile label={t("scrapPct")} value={scrapLabel} accent="var(--brand-prod)" />
        <KpiTile
          label={t("piecesPerDay")}
          value={
            isPending
              ? "—"
              : (cutting.reduce((acc, r) => acc + r.pieces, 0) || 0).toLocaleString(locale)
          }
          accent="var(--brand-prod)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t("cuttingThroughput")}
          loading={isPending}
          isEmpty={!isPending && cutting.length === 0}
          emptyMessage={tCharts("empty")}
          skeletonHeight={260}
        >
          <ThroughputChart data={cutting} stroke="var(--brand-prod)" />
        </ChartCard>

        <ChartCard
          title={t("sewingThroughput")}
          loading={isPending}
          isEmpty={!isPending && sewing.length === 0}
          emptyMessage={tCharts("empty")}
          skeletonHeight={260}
        >
          <ThroughputChart data={sewing} stroke="var(--brand-reports)" />
        </ChartCard>
      </div>
    </div>
  );
}

function ThroughputChart({
  data,
  stroke,
}: {
  data: { label: string; pieces: number }[];
  stroke: string;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
          <Line type="monotone" dataKey="pieces" stroke={stroke} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {label}
      </span>
      <span className="font-serif text-[28px] font-normal leading-none tracking-[-0.02em] text-[color:var(--orion-ink)]">
        {value}
      </span>
    </div>
  );
}
