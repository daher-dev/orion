"use client";

import { Minus, Plus } from "lucide-react";

type Props = {
  /** Current value as a string (kept as string to avoid cursor jumps). */
  value: string;
  onChange: (next: string) => void;
  /** Allow fractional input (paper meters). Counted tiers stay integer. */
  decimal?: boolean;
  /** Step applied by the -/+ buttons. */
  step?: number;
  /** Minimum clamp for the -/+ buttons. */
  min?: number;
  /** Suffix unit label rendered to the right (e.g. "m"). */
  suffix?: string;
  /** Marks the input invalid (red border). */
  invalid?: boolean;
  /** data-testid for the numeric input. */
  testId?: string;
};

/**
 * Quantity stepper — generalised from the `-/+` stepper in `StockAdjustDialog`
 * and the prototype `UnitMoveSheet`. Counted tiers use integer steps; the paper
 * tier passes `decimal` so meters accept a fractional value.
 */
export function QtySpinner({
  value,
  onChange,
  decimal = false,
  step = 1,
  min = 1,
  suffix,
  invalid,
  testId,
}: Props) {
  const parsed = Number(value.replace(",", "."));
  const sanitize = (raw: string) =>
    decimal ? raw.replace(/[^\d.,]/g, "") : raw.replace(/\D/g, "");

  return (
    <div className="flex max-w-[260px] items-center gap-2">
      <button
        type="button"
        aria-label="decrement"
        data-testid={testId ? `${testId}-decrement` : undefined}
        onClick={() => {
          const base = Number.isFinite(parsed) ? parsed : min;
          const next = Math.max(min, base - step);
          onChange(decimal ? String(next) : String(Math.round(next)));
        }}
        className="grid size-[38px] flex-shrink-0 cursor-pointer place-items-center rounded-[6px] border bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)] transition-colors hover:bg-[color:var(--orion-surface-2)]"
        style={{ borderColor: "var(--orion-line)" }}
      >
        <Minus size={14} strokeWidth={2} />
      </button>
      <input
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        data-testid={testId}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(sanitize(e.target.value))}
        className="min-w-0 flex-1 rounded-[8px] border bg-[color:var(--orion-surface)] py-[8px] text-center font-serif text-[22px] text-[color:var(--orion-ink)] tabular-nums outline-none"
        style={{ borderColor: invalid ? "var(--status-err)" : "var(--orion-line)" }}
      />
      <button
        type="button"
        aria-label="increment"
        data-testid={testId ? `${testId}-increment` : undefined}
        onClick={() => {
          const base = Number.isFinite(parsed) ? parsed : 0;
          const next = base + step;
          onChange(decimal ? String(next) : String(Math.round(next)));
        }}
        className="grid size-[38px] flex-shrink-0 cursor-pointer place-items-center rounded-[6px] border bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)] transition-colors hover:bg-[color:var(--orion-surface-2)]"
        style={{ borderColor: "var(--orion-line)" }}
      >
        <Plus size={14} strokeWidth={2} />
      </button>
      {suffix ? (
        <span className="text-[12px] text-[color:var(--orion-ink-3)]">{suffix}</span>
      ) : null}
    </div>
  );
}
