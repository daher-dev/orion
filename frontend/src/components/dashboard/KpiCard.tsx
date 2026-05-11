"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useLocale } from "next-intl";
import type { Kpi } from "@/lib/schemas/dashboard";

type Props = {
  kpi: Kpi;
  format?: "number" | "currency";
  accent?: string;
};

/**
 * KPI card — design `.kpi-card`: surface bg, line border, 14px radius,
 * padding 16 18, internal stack of label + 28px value + delta + sparkline.
 */
export function KpiCard({ kpi, format = "number", accent = "var(--brand-sales)" }: Props) {
  const locale = useLocale();

  const formatter =
    format === "currency"
      ? new Intl.NumberFormat(locale, {
          style: "currency",
          currency: locale.startsWith("pt") ? "BRL" : "USD",
          maximumFractionDigits: 0,
        })
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  const value = formatter.format(kpi.value);
  const delta = kpi.delta_pct;
  const positive = delta != null && delta >= 0;

  return (
    <div
      className="flex flex-col gap-2 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]"
      style={{ "--kpi-accent": accent } as React.CSSProperties}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {kpi.label}
      </span>
      <span className="font-serif text-[28px] font-normal leading-none tracking-[-0.02em] text-[color:var(--orion-ink)]">
        {value}
      </span>
      {delta != null ? (
        <span
          className="inline-flex items-center gap-1 text-[11.5px] font-medium"
          style={{
            color: positive ? "var(--status-ok)" : "var(--status-err)",
          }}
        >
          {positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {Math.abs(delta).toFixed(1)}%
        </span>
      ) : null}
      {kpi.sparkline && kpi.sparkline.length > 1 ? <Sparkline points={kpi.sparkline} accent={accent} /> : null}
    </div>
  );
}

function Sparkline({ points, accent }: { points: number[]; accent: string }) {
  const w = 100;
  const h = 24;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width="100%" height="24" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <path d={path} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
