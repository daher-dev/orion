"use client";

import { RoleTile } from "@/components/settings/roles/RoleTile";
import type { RoleList, RoleRead } from "@/lib/schemas/role";
import type { MemberRead } from "@/lib/schemas/member";

/**
 * 3-up grid of role tiles, the first row of content inside the Roles pane.
 *
 * Mirrors the wrapping div in /docs/design/source/pages/settings.jsx (~line
 * 346):
 *
 *   grid, gap 14px, gridTemplateColumns: repeat(auto-fit, minmax(240px, 1fr))
 *
 * The `tone` palette is hand-picked in the design source and we keep the
 * exact hex codes (purple / sky / emerald) so the strip + Shield tint match
 * pixel-for-pixel.  Tones are mapped by `role.code` (not by index) so the
 * order returned by the backend doesn't matter.
 */
const TONE_BY_CODE: Record<string, string> = {
  admin: "#7c5cff",
  manager: "#0ea5e9",
  operator: "#10b981",
};

const FALLBACK_TONE = "var(--brand-settings)";

// Hand-picked tones for custom roles, cycled by index so multiple custom roles
// stay visually distinct from the seeded triple and from each other.
const CUSTOM_TONES = ["#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6"];

export type RoleTilesGridProps = {
  roles: RoleList;
  /** Members list — used to compute the member count per role. */
  members: MemberRead[];
  /** When true, custom roles render an Edit affordance. */
  canWrite?: boolean;
  /** Invoked with the role to edit (custom roles only). */
  onEdit?: (role: RoleRead) => void;
};

export function RoleTilesGrid({ roles, members, canWrite = false, onEdit }: RoleTilesGridProps) {
  // Pre-compute role.code → member count once; cheaper than re-filtering for
  // each tile and keeps the tiles oblivious to the member shape.
  const counts = new Map<string, number>();
  for (const m of members) {
    const code = m.role.code;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return (
    <div
      data-testid="role-tiles-grid"
      // grid + auto-fit minmax(240, 1fr) → collapses gracefully on narrow
      // viewports.  Tailwind's arbitrary value preserves the exact 240/1fr
      // values from the design source.
      className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]"
    >
      {roles.map((role, i) => {
        const tone =
          TONE_BY_CODE[role.code] ??
          (role.is_custom ? CUSTOM_TONES[i % CUSTOM_TONES.length] : FALLBACK_TONE);
        return (
          <RoleTile
            key={role.id}
            code={role.code}
            memberCount={counts.get(role.code) ?? 0}
            tone={tone}
            customName={role.name}
            customDescription={role.description}
            onEdit={canWrite && role.is_custom && onEdit ? () => onEdit(role) : undefined}
          />
        );
      })}
    </div>
  );
}
