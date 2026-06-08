"use client";

import type { ReactNode } from "react";
import { Clock } from "lucide-react";

/**
 * Full-width "Em breve · dados ilustrativos" banner for pages whose backing
 * data isn't modeled yet (Plans, Integrations). Keeps the design intact while
 * being honest that the numbers below are illustrative, not live.
 */
export function SoonRibbon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-[12px] border border-dashed px-4 py-3 text-[12.5px] ${className}`}
      style={{
        color: "var(--console-accent)",
        borderColor: "color-mix(in oklab, var(--console-accent) 40%, transparent)",
        background: "color-mix(in oklab, var(--console-accent) 6%, var(--orion-surface))",
      }}
    >
      <Clock size={15} strokeWidth={2.2} className="shrink-0" />
      <span className="text-[color:var(--orion-ink-2)]">{children}</span>
    </div>
  );
}
