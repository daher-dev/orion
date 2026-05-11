"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { PermissionMatrix } from "@/components/settings/roles/PermissionMatrix";
import { useCanAccess } from "@/hooks/use-permissions";
import { useRoles } from "@/hooks/use-roles";

export default function SettingsRolesPage() {
  const t = useTranslations("roles");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("roles.read");
  const roles = useRoles();

  if (!canRead) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-10 text-center text-[color:var(--orion-ink-3)]">
        {tForbidden("roles")}
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="roles-card"
    >
      <header className="border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t("list.title")}
        </div>
        <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">{t("list.sub")}</div>
      </header>
      {roles.isPending ? (
        <div className="space-y-2 p-6">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      ) : (
        <PermissionMatrix roles={roles.data ?? []} />
      )}
    </section>
  );
}
