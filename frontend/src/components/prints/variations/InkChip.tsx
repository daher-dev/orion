"use client";

import { cn } from "@/lib/utils";

type Props = {
  ink: string;
  /** When false, renders the "pending" dashed/dimmed treatment with a warn dot. */
  ready: boolean;
  size?: number;
  title?: string;
  className?: string;
};

/**
 * A round ink swatch with a pending indicator. Port of `InkChip` from
 * docs/design/pages/catalog.jsx. `ready=false` (a variation missing PNGs)
 * dims the swatch, dashes the border in warn, and adds a small warn dot.
 */
export function InkChip({ ink, ready, size = 18, title, className }: Props) {
  return (
    <span
      title={title}
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
      data-testid="ink-chip"
      data-ready={ready || undefined}
    >
      <span
        className={cn(
          "block rounded-full",
          ready
            ? "border-[1.5px] border-[color:var(--orion-surface)] shadow-[0_0_0_1px_var(--orion-line)]"
            : "border-[1.5px] border-dashed border-[color:var(--status-warn)] opacity-55",
        )}
        style={{ width: size, height: size, background: ink }}
      />
      {!ready ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-[1.5px] border-[color:var(--orion-surface)] bg-[color:var(--status-warn)]"
          style={{ width: size * 0.42, height: size * 0.42 }}
        />
      ) : null}
    </span>
  );
}
