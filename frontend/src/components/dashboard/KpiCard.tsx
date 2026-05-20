"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useLocale } from "next-intl";
import type { CSSProperties } from "react";
import type { Kpi } from "@/lib/schemas/dashboard";

type Props = {
  kpi: Kpi;
  format?: "number" | "currency";
  accent?: string;
};

/**
 * KPI card — direct port of `.kpi` from /docs/design/source/styles.css
 * and the `<KPI>` component in /docs/design/source/pages/dashboard.jsx.
 *
 * Layout:
 *  - .kpi container: surface bg, line border, var(--radius-lg) (14px), padding
 *    16px 18px, flex column gap 8.
 *  - Header row: kpi-label (11px uppercase ink-3 tracking .1em weight 600) on
 *    the left, kpi-delta pill on the right.
 *  - kpi-value: Fraunces 30px / 400 / -.02em tracking / line-height 1 / ink.
 *  - Sparkline: 36px height, area-fill polyline at 8% opacity behind the line.
 *
 * The delta pill (kpi-delta) is a small rounded pill with an arrow icon —
 * .up adopts --ok/--ok-bg, .down adopts --err/--err-bg.
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
  const deltaSign = positive ? "+" : "";
  const deltaText = delta != null ? `${deltaSign}${delta.toFixed(1)}%` : null;

  return (
    <div
      // .kpi — surface bg, line border, radius-lg (14px), padding 16 18,
      // overflow hidden so the sparkline never bleeds into the edge.
      className="relative flex flex-col gap-2 overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]"
      style={{ "--kpi-accent": accent } as CSSProperties}
    >
      {/* Header row — label left, kpi-delta pill right (matches the design
          source where label + delta share a `display: flex` row). */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
          {kpi.label}
        </span>
        {deltaText ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-[6px] py-px text-[11.5px] font-semibold"
            style={{
              color: positive ? "var(--status-ok)" : "var(--status-err)",
              background: positive
                ? "color-mix(in oklab, var(--status-ok) 12%, var(--orion-surface))"
                : "color-mix(in oklab, var(--status-err) 12%, var(--orion-surface))",
            }}
          >
            {positive ? (
              <TrendingUp size={11} strokeWidth={2.5} />
            ) : (
              <TrendingDown size={11} strokeWidth={2.5} />
            )}
            {deltaText}
          </span>
        ) : null}
      </div>
      {/* .kpi-value — Fraunces 30 / 400 / -.02em / lh 1. */}
      <span className="font-serif text-[30px] font-normal leading-none tracking-[-0.02em] text-[color:var(--orion-ink)]">
        {value}
      </span>
      {kpi.sparkline && kpi.sparkline.length > 1 ? (
        // The design wraps the spark in a 4px-margin-top container coloured to
        // the accent — currentColor inside the svg lets the area fill inherit.
        <div className="mt-1" style={{ color: accent }}>
          <Sparkline points={kpi.sparkline} accent={accent} />
        </div>
      ) : null}
    </div>
  );
}

function Sparkline({ points, accent }: { points: number[]; accent: string }) {
  // .spark — width 100%, height 36px, preserveAspectRatio none so it stretches
  // to the container. Two polylines: the area fill at 8% opacity, then the
  // stroked line on top.
  const w = 120;
  const h = 36;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const linePts = points
    .map((p, i) => `${(i * step).toFixed(2)},${(h - ((p - min) / range) * (h - 4) - 2).toFixed(2)}`)
    .join(" ");
  const areaPts = `0,${h} ${linePts} ${w},${h}`;
  return (
    <svg
      className="spark"
      width="100%"
      height="36"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline points={areaPts} fill={accent} opacity="0.08" />
      <polyline
        points={linePts}
        fill="none"
        stroke={accent}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
