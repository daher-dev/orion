"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { PermissionLegend } from "@/components/settings/roles/PermissionLegend";
import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { RoleTilesGrid } from "@/components/settings/roles/RoleTilesGrid";
import { useMembers } from "@/hooks/use-members";
import { useCanAccess } from "@/hooks/use-permissions";
import { useRoles } from "@/hooks/use-roles";

/**
 * Settings → Funções pane.
 *
 * Direct port of `RolesPane` in /docs/design/source/pages/settings.jsx
 * (~lines 344-410).  Three vertically stacked rows in an 18px-gap grid:
 *
 *   1. Role tiles — 3-up grid with 3px coloured top stripe, Shield icon,
 *      Fraunces role name, and member-count pill.
 *   2. Permissions matrix card — Capacidade column + one column per role,
 *      capability rows grouped by domain (Sales / Catalog / Production /
 *      Stock / System).
 *   3. Legend strip — three labelled `PermCell`s explaining the chips.
 *
 * The "Criar função personalizada" card action is rendered but disabled —
 * the backend doesn't expose a custom-roles surface yet, so we keep the
 * button visible (per design) to set the user's expectation that this is
 * read-only for now.
 */
export default function SettingsRolesPage() {
  const t = useTranslations("roles");
  const tMatrix = useTranslations("roles.matrix");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("roles.read");
  const roles = useRoles();
  const members = useMembers();

  if (!canRead) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-10 text-center text-[color:var(--orion-ink-3)]">
        {tForbidden("roles")}
      </div>
    );
  }

  const isLoading = roles.isPending || members.isPending;

  return (
    // The design source wraps the pane in a 18px-gap grid (line 345).
    <div className="grid gap-[18px]" data-testid="roles-pane">
      {/* Row 1: role tiles (3-up grid). */}
      {isLoading ? (
        <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          <Skeleton className="h-[108px] rounded-[14px]" />
          <Skeleton className="h-[108px] rounded-[14px]" />
          <Skeleton className="h-[108px] rounded-[14px]" />
        </div>
      ) : (
        <RoleTilesGrid
          roles={roles.data ?? []}
          members={members.data?.items ?? []}
        />
      )}

      {/* Row 2: permissions matrix card. */}
      <section
        // .card — surface, 1px line border, 14px radius, overflow-hidden so
        // the table head doesn't bleed past the rounded corners.
        className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
        data-testid="permission-matrix-card"
      >
        {/* .card-head — 14 18 padding, border-bottom 1px line-soft,
            flex-between with the action on the right. */}
        <header className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
          <div>
            <div
              // .card-title — Fraunces 16px /500/-0.01em.
              className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]"
            >
              {tMatrix("title")}
            </div>
            <div
              // .card-sub — 12px ink-3.
              className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]"
            >
              {tMatrix("sub")}
            </div>
          </div>
          {/* `.btn` (secondary) with a leading plus icon — disabled because
              the backend doesn't yet expose custom-role creation.  Render the
              button anyway (per design) so the affordance is visible and the
              ink-3 colour communicates "coming soon". */}
          <button
            type="button"
            disabled
            // `.btn` — 7 13 padding, 6px radius, 1px line border, surface bg,
            // 13px /500, 7px gap with the icon.
            className="inline-flex h-auto cursor-not-allowed items-center gap-[7px] whitespace-nowrap rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink-3)] opacity-60"
            data-testid="create-custom-role"
            aria-disabled="true"
          >
            <Plus className="size-[13px]" strokeWidth={2} />
            {tMatrix("createCustom")}
          </button>
        </header>

        {/* Card body — `pad={false}` in design: the table provides its own
            padding via th/td. */}
        {isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <PermissionMatrix roles={roles.data ?? []} />
        )}
      </section>

      {/* Row 3: legend strip. */}
      <PermissionLegend />

      {/* Screen-reader-only landmark — the matrix card-head already
          communicates the intent visually, but assistive tech benefits from
          a single page-level heading anchor. */}
      <h2 className="sr-only">{t("list.title")}</h2>
    </div>
  );
}
