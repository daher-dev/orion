"use client";

import {
  ArrowRight,
  Boxes,
  GitBranch,
  Scissors,
  Send,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { PipelineCounts } from "@/lib/schemas/dashboard";

type Props = { pipeline: PipelineCounts };

type Stage = {
  key: keyof PipelineCounts;
  accent: string;
  labelKey: string;
  subKey: string;
  icon: LucideIcon;
};

/**
 * Production pipeline card — direct port of the `<Card title="Pipeline de
 * produção" pad={false}>` block in /docs/design/source/pages/dashboard.jsx.
 *
 * Layout follows `.pipe` from /docs/design/source/styles.css:
 *  - 5 equal columns, 10px gap.
 *  - Each `.pipe-stage`: surface bg, line border, var(--radius) (10px), padding
 *    14px 16px 16px, position relative + overflow hidden, with a 3px coloured
 *    top edge (the brand color of each stage).
 *  - Stage head: name (13px serif weight 500) + lucide icon, 8px mb.
 *  - Count: 28px serif weight 400 tracking -.02em line-height 1, colour
 *    inherited from the brand `--stage-color` so each card reads as its
 *    sub-product.
 *  - Sub label: 11px ink-3, 4px mt.
 *
 * The "conveyor flow" footer reproduces the `git-branch` row from the design,
 * with the 7.2 days fragment bolded inline.
 */
export function ProductionPipeline({ pipeline }: Props) {
  const t = useTranslations("dashboard.pipeline");

  const stages: readonly Stage[] = [
    {
      key: "total_pending_orders",
      accent: "var(--brand-sales)",
      labelKey: "stages.pendingOrders",
      subKey: "stageSubs.pendingOrders",
      icon: ShoppingBag,
    },
    {
      key: "in_cutting",
      accent: "var(--brand-prod)",
      labelKey: "stages.inCutting",
      subKey: "stageSubs.inCutting",
      icon: Scissors,
    },
    {
      key: "in_sewing",
      accent: "var(--brand-prod)",
      labelKey: "stages.inSewing",
      subKey: "stageSubs.inSewing",
      icon: Send,
    },
    {
      key: "in_stock",
      accent: "var(--brand-inv)",
      labelKey: "stages.inStock",
      subKey: "stageSubs.inStock",
      icon: Boxes,
    },
    {
      key: "shipped_30d",
      accent: "var(--brand-sales)",
      labelKey: "stages.shipped30d",
      subKey: "stageSubs.shipped30d",
      icon: Truck,
    },
  ] as const;

  return (
    // .card — surface bg, line border, var(--radius-lg) (14px) + overflow
    // hidden. The card-head + pad=false content padding split mirrors the
    // design source `<Card pad={false}>` exactly.
    <section className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      {/* .card-head — 14 18 padding, line-soft bottom border, 16px serif title
          + 12px ink-3 sub, action button right-aligned. */}
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub")}
          </div>
        </div>
        {/* .btn.btn-sm — 12px font, 4 9 padding, radius 5. */}
        <Link
          href="/production"
          className="inline-flex items-center gap-[6px] rounded-[5px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[9px] py-[4px] text-[12px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]"
        >
          {t("viewDetails")}
          <ArrowRight size={12} strokeWidth={1.8} />
        </Link>
      </div>

      {/* `pad=false` content body — design wraps the `.pipe` in 18px padding. */}
      <div className="px-[18px] py-[18px]">
        {/* .pipe — 5 columns, 10px gap. Collapses per the design's media query
            (under ~960px → 2 columns, under ~640px → 1 column). */}
        <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-5">
          {stages.map((stage) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.key}
                // .pipe-stage — surface bg, line border, radius var(--radius)
                // (10px), padding 14 16 16, relative + overflow hidden.
                className="relative overflow-hidden rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] pt-[14px] pr-[16px] pb-[16px] pl-[16px]"
              >
                {/* .pipe-stage::before — 3px coloured edge on the top. */}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: stage.accent }}
                />
                {/* .pipe-stage-head — name + icon row. The icon inherits the
                    default `--orion-ink` text colour from the card; only the
                    count adopts the stage accent (matches the design source). */}
                <div className="mb-[8px] flex items-center justify-between gap-2 text-[color:var(--orion-ink)]">
                  <div className="font-serif text-[13px] font-medium tracking-[-0.005em]">
                    {t(stage.labelKey)}
                  </div>
                  <Icon size={14} strokeWidth={1.75} />
                </div>
                {/* .pipe-stage-count — Fraunces 28 / 400 / -.02em / lh 1,
                    coloured by --stage-color so it reads as the sub-product. */}
                <div
                  className="font-serif text-[28px] font-normal leading-none tracking-[-0.02em]"
                  style={{ color: stage.accent, fontVariantNumeric: "tabular-nums" }}
                >
                  {pipeline[stage.key]}
                </div>
                {/* .pipe-stage-sub — 11px ink-3, 4px mt. */}
                <div className="mt-[4px] text-[11px] text-[color:var(--orion-ink-3)]">
                  {t(stage.subKey)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Conveyor flow footer — `<div style={{ display: 'flex', alignItems:
            'center', gap: 6, marginTop: 14 }}>` from the design source. The
            7.2 days fragment is rendered bold inline via t.rich. */}
        <div className="mt-[14px] flex items-center gap-[6px] text-[11px] text-[color:var(--orion-ink-3)]">
          <GitBranch size={12} strokeWidth={1.8} />
          <span>
            {t.rich("footer", {
              b: (chunks) => (
                <b className="font-medium text-[color:var(--orion-ink)]">{chunks}</b>
              ),
            })}
          </span>
          <span className="ml-auto">{t("updated", { minutes: 3 })}</span>
        </div>
      </div>
    </section>
  );
}
