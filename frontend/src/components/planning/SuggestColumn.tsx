"use client";

import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A suggestions column (Cortes / Impressões) — port of `SuggestColumn` from the
 * prototype `planejamento.jsx`. A card with a header (brand-tinted icon chip,
 * title + count, and the summed total + unit on the right), then the row list.
 * When there are no rows it renders the inline "Nada a produzir" empty state.
 */
type Props = {
  icon: LucideIcon;
  title: string;
  count: number;
  total: number;
  unit: string;
  emptyLabel: string;
  testId?: string;
  children: ReactNode;
};

export function SuggestColumn({ icon: Icon, title, count, total, unit, emptyLabel, testId, children }: Props) {
  const has = count > 0;
  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      <div className="flex items-center gap-[9px] border-b border-[color:var(--orion-line-soft)] px-4 py-3">
        <span
          className="grid size-7 flex-shrink-0 place-items-center rounded-lg"
          style={{
            background: "color-mix(in oklab, var(--brand-prod) 12%, var(--orion-surface))",
            color: "var(--brand-prod)",
          }}
        >
          <Icon size={15} strokeWidth={1.8} />
        </span>
        <div className="flex-1 text-[14px] font-medium text-[color:var(--orion-ink)]">
          {title} <span className="font-normal text-[color:var(--orion-ink-3)]">· {count}</span>
        </div>
        {has ? (
          <span className="text-[12px] text-[color:var(--orion-ink-3)]">
            <b className="font-serif text-[15px] text-[color:var(--orion-ink-2)] tabular-nums">{total}</b> {unit}
          </span>
        ) : null}
      </div>
      {has ? (
        <div data-testid={testId}>{children}</div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-[18px] py-[30px] text-center text-[12.5px] text-[color:var(--orion-ink-3)]">
          <Check size={20} className="text-[color:var(--status-ok)]" />
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
