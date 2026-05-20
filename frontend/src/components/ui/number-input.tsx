"use client";

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type NumberInputTone =
  | "sales"
  | "catalog"
  | "prod"
  | "inv"
  | "reports"
  | "settings"
  | "default";

type Align = "left" | "right" | "center";

export type NumberInputProps = {
  value: number | string | null | undefined;
  /**
   * Called with a canonical numeric string (dot-decimal, e.g. `"12.5"`)
   * or an empty string when the field is blanked. Always a string so the
   * callsite can decide whether to coerce to a number.
   */
  onChange: (next: string) => void;
  onBlur?: () => void;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  step?: number;
  min?: number;
  max?: number;
  /** Force decimals; otherwise inferred from step. */
  decimals?: number;
  align?: Align;
  placeholder?: string;
  disabled?: boolean;
  /** Drives the focus ring / border accent. */
  tone?: NumberInputTone;
  id?: string;
  name?: string;
  className?: string;
  /** Forwarded to the inner <input>. */
  inputClassName?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "data-testid"?: string;
  autoFocus?: boolean;
};

const TONE_VARS: Record<NumberInputTone, string> = {
  sales: "var(--brand-sales)",
  catalog: "var(--brand-catalog)",
  prod: "var(--brand-prod)",
  inv: "var(--brand-inv)",
  reports: "var(--brand-reports)",
  settings: "var(--brand-settings)",
  default: "var(--ring)",
};

function inferDecimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

/** Format a numeric value for pt-BR display. */
function formatPtBr(value: number | string | null | undefined, decimals: number): string {
  if (value === "" || value === null || value === undefined) return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Parse a pt-BR draft string into a number. Returns NaN on empty. */
function parseDraft(s: string): number {
  if (s === "" || s === "-") return Number.NaN;
  const cleaned = String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  return cleaned === "" ? Number.NaN : Number(cleaned);
}

function clamp(n: number, min: number | undefined, max: number | undefined): number {
  if (typeof min === "number" && n < min) return min;
  if (typeof max === "number" && n > max) return max;
  return n;
}

/**
 * Numeric input matching the design's `NumField` primitive — replaces the
 * native browser number spinner with a custom up/down stepper, supports
 * pt-BR formatting (decimal comma), and accepts an optional prefix (e.g.
 * `R$`) or suffix (e.g. `kg`).
 *
 * The component is controlled. While focused, the input shows a raw draft
 * (no thousands separator) so the cursor doesn't jump as the user types;
 * on blur, the value is parsed, clamped, and re-formatted. Arrow keys and
 * the stepper buttons bump by `step`.
 */
export function NumberInput({
  value,
  onChange,
  onBlur,
  prefix,
  suffix,
  step = 1,
  min,
  max,
  decimals,
  align = "left",
  placeholder,
  disabled = false,
  tone = "default",
  id,
  name,
  className,
  inputClassName,
  autoFocus,
  ...aria
}: NumberInputProps) {
  const resolvedDecimals = decimals ?? inferDecimals(step);
  const accent = TONE_VARS[tone];
  const invalid = aria["aria-invalid"] === true;

  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState<string>(() => formatPtBr(value, resolvedDecimals));

  React.useEffect(() => {
    if (!focused) setDraft(formatPtBr(value, resolvedDecimals));
  }, [value, focused, resolvedDecimals]);

  const emit = React.useCallback(
    (n: number | null) => {
      if (n === null || Number.isNaN(n)) {
        onChange("");
        return;
      }
      const fixed = Number(n.toFixed(10));
      onChange(String(fixed));
    },
    [onChange],
  );

  const currentNumber = (): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value !== "") {
      const n = Number(value.replace(",", "."));
      if (!Number.isNaN(n)) return n;
    }
    const parsed = parseDraft(draft);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const bump = (dir: 1 | -1) => {
    if (disabled) return;
    const next = clamp(Number((currentNumber() + dir * step).toFixed(10)), min, max);
    emit(next);
    setDraft(formatPtBr(next, resolvedDecimals));
  };

  const display = focused ? draft : formatPtBr(value, resolvedDecimals);

  const dynamicStyle: React.CSSProperties = {};
  if (invalid) {
    dynamicStyle.borderColor = "var(--status-err)";
    if (focused) {
      dynamicStyle.boxShadow =
        "0 0 0 3px color-mix(in oklab, var(--status-err) 20%, transparent)";
    }
  } else if (focused) {
    dynamicStyle.borderColor = accent;
    dynamicStyle.boxShadow = `0 0 0 3px color-mix(in oklab, ${accent} 16%, transparent)`;
  }

  return (
    <div
      data-slot="number-input"
      data-focused={focused ? "true" : undefined}
      data-invalid={invalid ? "true" : undefined}
      className={cn(
        "inline-flex w-full items-stretch overflow-hidden rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] transition-[border-color,box-shadow]",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      style={dynamicStyle}
    >
      {prefix ? (
        <span
          className="inline-flex select-none items-center pl-[11px] pr-[2px] text-[12px] text-[color:var(--orion-ink-3)]"
          aria-hidden="true"
        >
          {prefix}
        </span>
      ) : null}
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={aria["aria-invalid"]}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        data-testid={aria["data-testid"]}
        onFocus={(e) => {
          setFocused(true);
          // While focused, drop thousands separators but keep the decimal comma.
          const raw =
            value === null || value === undefined || value === ""
              ? ""
              : String(value).replace(".", ",");
          setDraft(raw);
          // Select-all so typing replaces the value.
          setTimeout(() => e.target.select(), 0);
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseDraft(draft);
          if (Number.isNaN(parsed)) {
            emit(null);
          } else {
            emit(clamp(parsed, min, max));
          }
          onBlur?.();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(-1);
          } else if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "min-w-0 flex-1 border-0 bg-transparent px-[11px] py-[8px] text-[13px] tabular-nums text-[color:var(--orion-ink)] outline-none placeholder:text-[color:var(--orion-ink-3)]",
          prefix ? "pl-[6px]" : null,
          suffix ? "pr-[6px]" : null,
          align === "right" && "text-right",
          align === "center" && "text-center",
          inputClassName,
        )}
      />
      {suffix ? (
        <span
          className="inline-flex select-none items-center pl-[2px] pr-[11px] text-[12px] text-[color:var(--orion-ink-3)]"
          aria-hidden="true"
        >
          {suffix}
        </span>
      ) : null}
      <span
        className="inline-flex w-[22px] flex-col border-l border-[color:var(--orion-line)]"
        aria-hidden="true"
      >
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => bump(1)}
          className="flex flex-1 items-center justify-center text-[color:var(--orion-ink-3)] transition-colors hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)] active:bg-[color:var(--orion-surface-2)]"
          aria-label="Aumentar"
        >
          <ChevronUp size={10} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => bump(-1)}
          className="flex flex-1 items-center justify-center border-t border-[color:var(--orion-line)] text-[color:var(--orion-ink-3)] transition-colors hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)] active:bg-[color:var(--orion-surface-2)]"
          aria-label="Diminuir"
        >
          <ChevronDown size={10} strokeWidth={2.4} />
        </button>
      </span>
    </div>
  );
}
