"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Console page header — ported from `ConsoleHead` in /docs/design/admin/shell.jsx.
 * Eyebrow mark + title (with optional emphasized tail) + description + actions.
 */
export function ConsoleHead({
  icon: Icon,
  color = "var(--console-accent)",
  eyebrow,
  title,
  titleEm,
  desc,
  actions,
}: {
  icon: LucideIcon;
  color?: string;
  eyebrow: ReactNode;
  title: ReactNode;
  titleEm?: ReactNode;
  desc?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[18px] flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
          <span className="grid size-[18px] place-items-center rounded-[5px] text-white" style={{ background: color }}>
            <Icon size={11} strokeWidth={2.2} />
          </span>
          {eyebrow}
        </div>
        <h1 className="mt-2 font-serif text-[26px] leading-tight font-normal tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {title} {titleEm && <em className="text-[color:var(--console-accent)] italic">{titleEm}</em>}
        </h1>
        {desc && <p className="mt-1.5 max-w-[640px] text-[13px] text-[color:var(--orion-ink-3)]">{desc}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
