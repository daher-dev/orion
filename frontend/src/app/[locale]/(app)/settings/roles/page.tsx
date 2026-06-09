"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { PermissionLegend } from "@/components/settings/roles/PermissionLegend";
import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { RoleEditorSheet } from "@/components/settings/roles/RoleEditorSheet";
import { RoleTilesGrid } from "@/components/settings/roles/RoleTilesGrid";
import { useMembers } from "@/hooks/use-members";
import { useCanAccess } from "@/hooks/use-permissions";
import { useRoles } from "@/hooks/use-roles";
import type { RoleRead } from "@/lib/schemas/role";

/**
 * Settings → Funções pane.
 *
 * Port of `RolesPane` in /docs/design/source/pages/settings.jsx (~lines
 * 344-410): role tiles grid + "Matriz de permissões" card + legend.
 *
 * Custom (company-owned) roles are editable: "Criar função personalizada"
 * opens the {@link RoleEditorSheet} to create one, and custom-role columns in
 * the matrix toggle permissions inline. The 3 global seeded roles stay
 * read-only. Edit affordances are gated behind `roles.write`.
 */
export default function SettingsRolesPage() {
  const t = useTranslations("roles");
  const tMatrix = useTranslations("roles.matrix");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("roles.read");
  const canWrite = useCanAccess("roles.write");
  const roles = useRoles();
  const members = useMembers();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRead | undefined>(undefined);

  const openCreate = () => {
    setEditing(undefined);
    setEditorOpen(true);
  };
  const openEdit = (role: RoleRead) => {
    setEditing(role);
    setEditorOpen(true);
  };

  if (!canRead) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-10 text-center text-[color:var(--orion-ink-3)]">
        {tForbidden("roles")}
      </div>
    );
  }

  const isLoading = roles.isPending || members.isPending;

  return (
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
          canWrite={canWrite}
          onEdit={openEdit}
        />
      )}

      {/* Row 2: permissions matrix card. */}
      <section
        className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
        data-testid="permission-matrix-card"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
          <div>
            <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {tMatrix("title")}
            </div>
            <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
              {tMatrix("sub")}
            </div>
          </div>
          {/* `.btn` (secondary) with a leading plus icon. Enabled only when the
              user holds `roles.write`; otherwise rendered disabled (per design,
              the affordance stays visible). */}
          <button
            type="button"
            disabled={!canWrite}
            onClick={openCreate}
            className={`inline-flex h-auto items-center gap-[7px] whitespace-nowrap rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium ${
              canWrite
                ? "cursor-pointer text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]"
                : "cursor-not-allowed text-[color:var(--orion-ink-3)] opacity-60"
            }`}
            data-testid="create-custom-role"
            aria-disabled={!canWrite}
          >
            <Plus className="size-[13px]" strokeWidth={2} />
            {tMatrix("createCustom")}
          </button>
        </header>

        {isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <PermissionMatrix
            roles={roles.data ?? []}
            canWrite={canWrite}
            onEditRole={openEdit}
          />
        )}
      </section>

      {/* Row 3: legend strip. */}
      <PermissionLegend />

      <h2 className="sr-only">{t("list.title")}</h2>

      <RoleEditorSheet open={editorOpen} onOpenChange={setEditorOpen} initial={editing} />
    </div>
  );
}
