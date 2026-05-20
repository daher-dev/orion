"use client";

import { useTranslations } from "next-intl";

import { PermCell, type PermCellKind } from "@/components/settings/roles/PermCell";

/**
 * Legend strip below the permissions matrix.
 *
 * Mirrors the bottom flexbox row at lines 398-407 of
 * /docs/design/source/pages/settings.jsx:
 *
 *   - inline-flex layout with 18px column gap and 4px horizontal padding so
 *     the icons sit a hair inside the matrix card edges
 *   - each item is a 6px-gap row: `PermCell` chip + 11.5px ink-3 label
 *
 * Renders the three known kinds in the same order as the design: all → view
 * → none.
 */

const ORDER: ReadonlyArray<PermCellKind> = ["all", "view", "none"];

export function PermissionLegend() {
  const t = useTranslations("roles.legend");
  return (
    <div
      data-testid="permission-legend"
      // 18px gap between items, 11.5px ink-3 label, 4px horizontal padding so
      // the strip aligns with the matrix card's inner spacing.
      className="flex flex-wrap items-center gap-[18px] px-1 text-[11.5px] text-[color:var(--orion-ink-3)]"
    >
      {ORDER.map((kind) => (
        <span
          key={kind}
          // 6px gap between chip + label — design line 399-401.
          className="inline-flex items-center gap-1.5"
        >
          <PermCell kind={kind} />
          {t(kind)}
        </span>
      ))}
    </div>
  );
}
