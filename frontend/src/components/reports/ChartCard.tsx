"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  title: string;
  sub?: string;
  /** When true, renders a skeleton at the supplied `skeletonHeight` instead of children. */
  loading?: boolean;
  /** Height for the skeleton placeholder. Defaults to 200px. */
  skeletonHeight?: number;
  /** Optional empty-state message rendered when `isEmpty` is true. */
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Optional action node rendered on the right of the header (button, link, etc.). */
  action?: ReactNode;
  /** Body padding override; defaults to true. Pass `false` for tables. */
  pad?: boolean;
  children: ReactNode;
};

/**
 * Reusable card shell — direct port of `.card` + `.card-head` + `.card-pad`
 * from /docs/design/source/styles.css.
 *
 *  - `.card`     — surface bg, 1px line border, 14px radius, overflow hidden.
 *  - `.card-head`— 14/18 padding, line-soft border-bottom, 16px serif title +
 *                  12px ink-3 sub.
 *  - `.card-pad` — 18/20 padding for the body when not in table mode.
 */
export function ChartCard({
  title,
  sub,
  loading,
  skeletonHeight = 200,
  isEmpty,
  emptyMessage,
  action,
  pad = true,
  children,
}: Props) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      {/* .card-head — 14 18 padding, 12px gap, line-soft bottom border. */}
      <header className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div className="min-w-0">
          {/* .card-title — Fraunces 16px / 500 / -0.01em tracking. */}
          <h2 className="font-serif text-[16px] font-medium leading-tight tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {title}
          </h2>
          {sub ? (
            <p className="mt-[2px] text-[12px] text-[color:var(--orion-ink-3)]">{sub}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      {/* Card body — design source `ui.jsx` uses inline `padding: 14px 18px 18px`. */}
      <div className={pad ? "px-[18px] pb-[18px] pt-[14px]" : undefined}>
        {loading ? (
          <Skeleton
            className="w-full rounded-[10px]"
            style={{ height: skeletonHeight }}
          />
        ) : isEmpty ? (
          <div className="grid place-items-center px-4 py-10 text-center text-[12.5px] text-[color:var(--orion-ink-3)]">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
