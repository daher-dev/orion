"use client";

import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Factory,
  Layers,
  Scissors,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { NeedsActionItem } from "@/lib/schemas/dashboard";

type Props = { items: NeedsActionItem[] };

type KindMeta = { icon: LucideIcon; accent: string };

/**
 * Map backend `kind` identifiers onto the design's sub-product icon + color
 * vocabulary (from /docs/design/source/ui.jsx SUBS). The design groups
 * pendencies by sub-product: orders → sales (terracotta), fabric → inv
 * (amber), shipments → production (teal), stock → inv (amber).
 */
const KIND_META: Record<string, KindMeta> = {
  orders_pending: { icon: ShoppingBag, accent: "var(--brand-sales)" },
  cutting_pending: { icon: Scissors, accent: "var(--brand-prod)" },
  sewing_open: { icon: Factory, accent: "var(--brand-prod)" },
  shipment_overdue: { icon: Truck, accent: "var(--brand-prod)" },
  fabric_low: { icon: Layers, accent: "var(--brand-inv)" },
  stock_low: { icon: Boxes, accent: "var(--brand-inv)" },
};

const FALLBACK_META: KindMeta = {
  icon: AlertTriangle,
  accent: "var(--brand-reports)",
};

/**
 * "Precisa da sua atenção" card — direct port of the second
 * `<Card title="Precisa da sua atenção" pad={false}>` block from
 * /docs/design/source/pages/dashboard.jsx.
 *
 * Layout:
 *  - .card shell (surface bg, line border, var(--radius-lg) 14px, overflow
 *    hidden), .card-head with title + count sub + ghost "Ver todas" action.
 *  - Rows are 12px 18px padding, line-soft border between them (no border on
 *    the last row), arrow-right on the right rail.
 *  - Each row leads with a 32×32 rounded-8 soft-tinted square whose tint
 *    derives from the sub-product accent (color-mix 14% + surface), housing a
 *    15px lucide icon in the accent colour.
 *  - Item text: 13.5px ink, optional sub line 11.5px ink-3 at 2px margin-top.
 */
export function NeedsActionList({ items }: Props) {
  const t = useTranslations("dashboard.needsAction");

  return (
    <section className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      {/* .card-head — 14 18 padding, line-soft border-b. */}
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub", { count: items.length })}
          </div>
        </div>
        {/* .btn.btn-sm.btn-ghost — transparent, ink-2, hover surface-2. */}
        <Link
          href="/orders?status=pending"
          className="inline-flex items-center gap-1 rounded-[5px] px-[9px] py-[4px] text-[12px] font-medium text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
        >
          {t("viewAll")}
        </Link>
      </div>

      {items.length === 0 ? (
        // Empty state — slim variant of `<Empty>` since this is a card body,
        // not a full page. Matches the muted ink-3 tone the design uses.
        <div className="px-[18px] py-[28px] text-center text-[13px] text-[color:var(--orion-ink-3)]">
          {t("empty")}
        </div>
      ) : (
        // Design uses `<div style={{ padding: '4px 0' }}>` to inset the rows
        // top/bottom. Each row carries its own padding so the dividers run
        // edge-to-edge.
        <ul className="m-0 flex list-none flex-col p-0 py-[4px]">
          {items.map((item, idx) => {
            const meta = KIND_META[item.kind] ?? FALLBACK_META;
            const Icon = meta.icon;
            const isLast = idx === items.length - 1;
            return (
              <li key={`${item.kind}-${idx}`}>
                <Link
                  href={item.link}
                  className={
                    "flex items-center gap-3 px-[18px] py-[12px] text-[color:var(--orion-ink-2)] transition-colors hover:bg-[color:var(--orion-bg)] " +
                    (isLast
                      ? ""
                      : "border-b border-[color:var(--orion-line-soft)]")
                  }
                >
                  {/* 32×32 soft-tinted square with the sub-product accent. */}
                  <span
                    aria-hidden
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]"
                    style={{
                      background: `color-mix(in oklab, ${meta.accent} 14%, var(--orion-surface))`,
                      color: meta.accent,
                    }}
                  >
                    <Icon size={15} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] text-[color:var(--orion-ink)]">
                      {item.message}
                    </div>
                  </div>
                  <ArrowRight
                    size={14}
                    strokeWidth={1.8}
                    className="shrink-0 text-[color:var(--orion-ink-3)]"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
