"use client";

import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * Catalog help card — ports `HelpCard` + `HelpBody` + `Flow` from
 * `docs/design/pages/catalog.jsx`. A tinted panel with a titled intro and an
 * optional left-to-right flow of labelled steps, used atop catalog list pages.
 */

export type HelpFlowStep = {
  icon: LucideIcon;
  label: string;
  sub?: string;
  accent?: boolean;
};

export type HelpCardProps = {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  steps?: HelpFlowStep[];
  /** CSS var or color driving the icon chip + accent steps. */
  tone?: string;
};

export function HelpCard({ icon: Icon, title, children, steps, tone = "var(--brand-catalog)" }: HelpCardProps) {
  return (
    <div
      className="mb-4 rounded-[14px] border border-[color:var(--orion-line-soft)] p-4"
      style={{ background: `color-mix(in oklab, ${tone} 5%, var(--orion-surface))` }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[6px] text-white"
          style={{ background: tone }}
        >
          <Icon size={13} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          {/* Not a heading element: the page's PageHead owns the single main
              heading; this supplementary card title must not collide with it. */}
          <p className="text-[13px] font-semibold text-[color:var(--orion-ink)]">{title}</p>
          {children ? (
            <div className="mt-1 max-w-[70ch] text-[12.5px] leading-[1.5] text-[color:var(--orion-ink-2)]">
              {children}
            </div>
          ) : null}
        </div>
      </div>

      {steps && steps.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5"
                style={{
                  background: step.accent
                    ? `color-mix(in oklab, ${tone} 12%, var(--orion-surface))`
                    : "var(--orion-surface)",
                  borderColor: step.accent
                    ? `color-mix(in oklab, ${tone} 30%, var(--orion-surface))`
                    : "var(--orion-line-soft)",
                }}
              >
                <step.icon
                  size={13}
                  strokeWidth={1.8}
                  style={{ color: step.accent ? tone : "var(--orion-ink-3)" }}
                />
                <span className="flex flex-col leading-tight">
                  <span className="text-[12px] font-medium text-[color:var(--orion-ink)]">
                    {step.label}
                  </span>
                  {step.sub ? (
                    <span className="text-[10.5px] text-[color:var(--orion-ink-3)]">{step.sub}</span>
                  ) : null}
                </span>
              </div>
              {i < steps.length - 1 ? (
                <ChevronRight size={13} className="text-[color:var(--orion-ink-3)]" />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
