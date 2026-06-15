import type { ReactNode } from "react";
import { Check } from "lucide-react";

/**
 * A component line for an assembly card — port of `CompLine` from `printing.jsx`.
 * Shows a blank-piece / printed-transfer requirement: quantity is always
 * visible; available vs missing is distinguished by the check/icon + colour.
 */
type Props = {
  ok: boolean;
  icon: ReactNode;
  label: string;
  qty: number;
};

export function CompLine({ ok, icon, label, qty }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="grid size-[22px] flex-shrink-0 place-items-center rounded-[6px] border"
        style={{
          background: ok ? "var(--status-ok-bg, color-mix(in oklab, var(--status-ok) 14%, var(--orion-surface)))" : "color-mix(in oklab, var(--status-warn) 14%, var(--orion-surface))",
          color: ok ? "var(--status-ok)" : "var(--status-warn)",
          borderColor: `color-mix(in oklab, ${ok ? "var(--status-ok)" : "var(--status-warn)"} 22%, var(--orion-surface))`,
        }}
      >
        {ok ? <Check size={12} strokeWidth={2} /> : icon}
      </span>
      <span className="whitespace-nowrap text-[12.5px] text-[color:var(--orion-ink-2)]">
        <b
          className="font-serif text-[13.5px]"
          style={{ color: ok ? "var(--orion-ink)" : "var(--status-warn)" }}
        >
          {qty}×
        </b>{" "}
        {label}
      </span>
    </div>
  );
}
