"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Clock } from "lucide-react";

// Console button — the design's `.btn` / `.btn-primary` / `.btn-sm`. A thin
// wrapper so pages never hand-roll raw <button> styling.
export function ConsoleButton({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "md" | "sm";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-[8px] font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none";
  const sizes = size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-[7px] text-[13px]";
  const variants: Record<string, string> = {
    default:
      "border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]",
    primary: "bg-[color:var(--console-accent)] text-white hover:opacity-90",
    ghost: "text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]",
    danger:
      "border text-[color:var(--status-err)] hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]",
  };
  const dangerBorder = variant === "danger" ? { borderColor: "color-mix(in oklab, var(--status-err) 30%, var(--orion-line))" } : undefined;
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} style={dangerBorder} {...props}>
      {children}
    </button>
  );
}

/**
 * Small visual primitives for the Platform Console, ported from
 * /docs/design/admin/{shell,organizations,users}.jsx. They reuse the warm
 * --orion-* surface tokens but carry the console's indigo --console-accent.
 */

// Organization identity square (initials on the org's accent color).
export function OrgMark({ name, accent, size = 34 }: { name: string; accent: string; size?: number }) {
  const initials =
    name
      .split(/\s+/)
      .filter((w) => w.length > 1 || /\d/.test(w))
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";
  return (
    <span
      className="grid shrink-0 place-items-center font-semibold text-white"
      style={{
        background: accent,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.44),
        borderRadius: Math.round(size * 0.26),
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.15)",
      }}
    >
      {initials}
    </span>
  );
}

type Tone = "ok" | "warn" | "err" | "info" | "muted";

const TONE_VARS: Record<Tone, string> = {
  ok: "var(--status-ok)",
  warn: "var(--status-warn)",
  err: "var(--status-err)",
  info: "var(--status-info)",
  muted: "var(--orion-ink-3)",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const color = TONE_VARS[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] text-[11.5px] font-medium whitespace-nowrap"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 12%, var(--orion-surface))`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

// "Em breve" — marks a section whose backing data isn't modeled yet.
export function SoonBadge({ children }: { children?: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-[2px] text-[10.5px] font-semibold uppercase tracking-[0.08em]"
      style={{
        color: "var(--console-accent)",
        borderColor: "color-mix(in oklab, var(--console-accent) 40%, transparent)",
        background: "color-mix(in oklab, var(--console-accent) 7%, var(--orion-surface))",
      }}
    >
      <Clock size={10} strokeWidth={2.4} />
      {children ?? "Em breve"}
    </span>
  );
}

// Console card with the design's title/sub/action header.
export function ConsoleCard({
  title,
  sub,
  action,
  pad = true,
  children,
  className = "",
}: {
  title?: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
  pad?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
          <div className="min-w-0">
            {title && (
              <div className="font-serif text-[15px] font-medium text-[color:var(--orion-ink)]">{title}</div>
            )}
            {sub && <div className="text-[12px] text-[color:var(--orion-ink-3)]">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={pad ? "p-[18px]" : ""}>{children}</div>
    </div>
  );
}

// Metric tile (KPI) — label + big value + optional foot/delta.
export function Metric({
  label,
  value,
  foot,
  accent = false,
  soon = false,
}: {
  label: ReactNode;
  value: ReactNode;
  foot?: ReactNode;
  accent?: boolean;
  soon?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
          {label}
        </span>
        {soon && <SoonBadge />}
      </div>
      <span
        className="font-serif text-[30px] leading-none font-normal tracking-[-0.02em]"
        style={{ color: accent ? "var(--console-accent)" : "var(--orion-ink)" }}
      >
        {value}
      </span>
      {foot && <div className="text-[11.5px] text-[color:var(--orion-ink-3)]">{foot}</div>}
    </div>
  );
}

// Usage meter bar (orders/seats), with warn/err level coloring.
export function Meter({ value, cap }: { value: number; cap: number }) {
  const unlimited = cap >= 999999;
  const pct = unlimited ? 12 : Math.min(100, (value / cap) * 100);
  const color = !unlimited && pct >= 100 ? "var(--status-err)" : !unlimited && pct >= 80 ? "var(--status-warn)" : "var(--console-accent)";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--orion-surface-2)]">
      <span
        className="block h-full rounded-full"
        style={{ width: `${pct}%`, background: color, opacity: unlimited ? 0.5 : 1 }}
      />
    </div>
  );
}

export function useFormatters(locale: string) {
  const brl = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
  const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return { fmtBRL: (n: number) => brl.format(n), fmtInt: (n: number) => int.format(n) };
}
