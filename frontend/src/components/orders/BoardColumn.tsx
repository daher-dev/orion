"use client";

import type { LucideIcon } from "lucide-react";

/**
 * One column of the Pedidos board (port of `separacao.jsx` `BoardColumn`).
 * Surface card with a header (tinted icon + label + count) and an optional
 * header action slot, over a vertical stack of cards.
 */
type Props = {
  label: string;
  icon: LucideIcon;
  /** CSS color for the icon tint. */
  color: string;
  count: number;
  headerExtra?: React.ReactNode;
  emptyText: string;
  isEmpty: boolean;
  children: React.ReactNode;
  testId?: string;
};

export function BoardColumn({
  label,
  icon: Icon,
  color,
  count,
  headerExtra,
  emptyText,
  isEmpty,
  children,
  testId,
}: Props) {
  return (
    <div
      data-testid={testId}
      className="min-w-0 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-3"
    >
      <div className="flex items-center justify-between gap-2 px-1.5 pb-2.5 pt-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-[7px]"
            style={{
              background: `color-mix(in oklab, ${color} 15%, var(--orion-surface))`,
              color,
            }}
          >
            <Icon size={14} strokeWidth={1.8} />
          </span>
          <span className="whitespace-nowrap text-[12.5px] font-semibold text-[color:var(--orion-ink)]">
            {label}
          </span>
          <span className="text-[11px] text-[color:var(--orion-ink-3)]">{count}</span>
        </div>
        {headerExtra}
      </div>
      <div className="grid min-h-[40px] gap-2">
        {isEmpty ? (
          <div className="px-3 py-[22px] text-center text-[12px] text-[color:var(--orion-ink-3)]">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
