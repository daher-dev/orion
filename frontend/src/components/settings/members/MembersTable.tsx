"use client";

import { useMemo, useState } from "react";
import { Trash2, Users as UsersIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RoleSelect } from "@/components/settings/members/RoleSelect";
import { useRemoveMember, useUpdateMemberRole } from "@/hooks/use-members";
import { useCanAccess } from "@/hooks/use-permissions";
import type { MemberRead } from "@/lib/schemas/member";
import type { RoleList } from "@/lib/schemas/role";

const avBg = (id: string) => {
  const palette = [
    "var(--brand-settings)",
    "var(--brand-prod)",
    "var(--brand-catalog)",
    "var(--brand-reports)",
    "var(--brand-inv)",
  ];
  const last = id.length > 0 ? id.charCodeAt(id.length - 1) : 0;
  return palette[last % palette.length];
};

function Avatar({ name, id }: { name: string; id: string }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-grid h-7 w-7 place-items-center rounded-full font-serif text-[11px] font-semibold text-white"
      style={{ background: avBg(id) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export type MembersTableProps = {
  rows: MemberRead[];
  /** Roles list (pre-fetched at the page level so each row reuses the same payload). */
  roles?: RoleList;
};

export function MembersTable({ rows, roles }: MembersTableProps) {
  const t = useTranslations("members");
  const locale = useLocale();
  const canWrite = useCanAccess("users.write");
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const [pendingRemove, setPendingRemove] = useState<MemberRead | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale],
  );

  const handleRoleChange = async (member: MemberRead, roleId: string) => {
    if (roleId === member.role.id) return;
    try {
      await updateRole.mutateAsync({ id: member.id, payload: { role_id: roleId } });
      toast.success(t("toasts.roleUpdated"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const isLastAdmin = detail.includes("last administrator");
      toast.error(
        isLastAdmin ? t("lastAdminGuard") : t("toasts.error"),
        !isLastAdmin && detail ? { description: detail } : undefined,
      );
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemove) return;
    try {
      await removeMember.mutateAsync(pendingRemove.id);
      toast.success(t("toasts.removed"));
      setPendingRemove(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const isLastAdmin = detail.includes("last administrator");
      toast.error(
        isLastAdmin ? t("lastAdminGuard") : t("toasts.error"),
        !isLastAdmin && detail ? { description: detail } : undefined,
      );
    }
  };

  return (
    <>
      <table className="w-full border-separate border-spacing-0 text-[13px]" data-testid="members-table">
        <thead>
          <tr>
            {(
              [
                ["name", "name"],
                ["email", "email"],
                ["role", "role"],
                ["joinedAt", "joinedAt"],
                ["actions", "actions"],
              ] as const
            ).map(([id, key]) => (
              <th
                key={id}
                className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)] ${
                  id === "actions" ? "text-right" : ""
                }`}
              >
                {id === "actions" ? (
                  <span className="sr-only">{t(`table.columns.${key}`)}</span>
                ) : (
                  t(`table.columns.${key}`)
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((member, idx) => (
            <tr
              key={member.id}
              data-testid="members-row"
              data-member-id={member.id}
              className="hover:[&_td]:bg-[color:var(--orion-bg)]"
            >
              <td
                className={`px-[14px] py-[12px] align-middle ${idx < rows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={member.name} id={member.id} />
                  <span className="font-medium text-[color:var(--orion-ink)]">{member.name}</span>
                </div>
              </td>
              <td
                className={`px-[14px] py-[12px] align-middle font-mono text-[12px] text-[color:var(--orion-ink)] ${idx < rows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
              >
                {member.email}
              </td>
              <td
                className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${idx < rows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
              >
                <RoleSelect
                  value={member.role.id}
                  roles={roles}
                  onChange={(roleId) => void handleRoleChange(member, roleId)}
                  disabled={!canWrite}
                  ariaLabel={`${t("actions.changeRole")} — ${member.name}`}
                />
              </td>
              <td
                className={`px-[14px] py-[12px] align-middle text-[12px] text-[color:var(--orion-ink-3)] ${idx < rows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {dateFormatter.format(new Date(member.created_at))}
              </td>
              <td
                className={`px-[14px] py-[12px] align-middle text-right ${idx < rows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
              >
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${t("actions.remove")} — ${member.name}`}
                    data-testid="member-remove"
                    onClick={() => setPendingRemove(member)}
                    className="h-8 w-8 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UsersIcon className="size-4 text-[color:var(--brand-settings)]" />
              {t("actions.remove")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("actions.confirmRemove")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMember.isPending}
              data-testid="member-remove-confirm"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRemove();
              }}
            >
              {t("actions.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
