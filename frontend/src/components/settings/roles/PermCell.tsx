import type { CSSProperties } from "react";
import { Check, Eye, Lock } from "lucide-react";

/**
 * 24×24 rounded-6 chip used in the role permissions matrix.
 *
 * Direct port of `PermCell` in /docs/design/source/pages/settings.jsx
 * (just before `RolesPane`). Three states:
 *
 *   - `all`  → green check on a 14%-tinted `--status-ok` surface
 *   - `view` → blue eye on a 12%-tinted `--status-info` surface
 *   - `none` → muted lock on `--orion-surface-2` with a 1px `--orion-line-soft`
 *             border and 65% opacity icon
 *
 * The wrapping span renders `data-kind` so it can be queried in tests and
 * styled consistently in the legend strip below the matrix.
 */
export type PermCellKind = "all" | "view" | "none";

export type PermCellProps = {
  kind: PermCellKind;
  /** Title attribute shown on hover (e.g. localised "Can edit"). */
  label?: string;
};

const TILES: Record<
  PermCellKind,
  {
    color: string;
    background: string;
    border: string;
    iconOpacity: number;
  }
> = {
  all: {
    color: "var(--status-ok)",
    background: "color-mix(in oklab, var(--status-ok) 14%, var(--orion-surface))",
    border: "1px solid transparent",
    iconOpacity: 1,
  },
  view: {
    color: "var(--status-info)",
    background: "color-mix(in oklab, var(--status-info) 12%, var(--orion-surface))",
    border: "1px solid transparent",
    iconOpacity: 1,
  },
  none: {
    color: "var(--orion-ink-3)",
    background: "var(--orion-surface-2)",
    border: "1px solid var(--orion-line-soft)",
    iconOpacity: 0.65,
  },
};

export function PermCell({ kind, label }: PermCellProps) {
  const t = TILES[kind];
  const Icon = kind === "all" ? Check : kind === "view" ? Eye : Lock;
  return (
    <span
      data-testid="perm-cell"
      data-kind={kind}
      title={label}
      // inline-grid + place-items-center matches the design source exactly.
      className="inline-grid h-6 w-6 place-items-center rounded-[6px]"
      style={
        {
          background: t.background,
          border: t.border,
        } as CSSProperties
      }
    >
      <Icon
        // 13px icon at strokeWidth 2.4, currentColor-tinted via the wrapping span.
        size={13}
        strokeWidth={2.4}
        style={{ color: t.color, opacity: t.iconOpacity }}
      />
    </span>
  );
}
