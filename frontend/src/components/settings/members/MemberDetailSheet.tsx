"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoleSelect } from "@/components/settings/members/RoleSelect";
import { useRemoveMember, useUpdateMemberRole } from "@/hooks/use-members";
import { useCanAccess } from "@/hooks/use-permissions";
import type { MemberRead } from "@/lib/schemas/member";
import type { RoleList } from "@/lib/schemas/role";

/**
 * Side sheet for inspecting and managing a single member. Mirrors the
 * design's drawer rhythm — head (member identity), body (read-only meta +
 * role select), footer (Remove on the left when canWrite, Close on the
 * right). Used everywhere we'd otherwise put an inline ⋯ / 🗑 action on
 * the members table.
 */
export type MemberDetailSheetProps = {
  member: MemberRead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles?: RoleList;
};

const SHEET_CLASS =
  "flex h-full w-[440px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

const FIELD_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";

const FIELD_VALUE_CLASS = "text-[13.5px] text-[color:var(--orion-ink)]";

const DELETE_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] shadow-none hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]";

const CANCEL_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Same palette + hash as MembersTable's row avatar so the sheet's identity
// chip matches the row the user clicked from.
const AV_PALETTE = [
  "var(--brand-settings)",
  "var(--brand-prod)",
  "var(--brand-catalog)",
  "var(--brand-reports)",
  "var(--brand-inv)",
] as const;

function avBg(id: string) {
  const last = id.length > 0 ? id.charCodeAt(id.length - 1) : 0;
  return AV_PALETTE[last % AV_PALETTE.length];
}

export function MemberDetailSheet({
  member,
  open,
  onOpenChange,
  roles,
}: MemberDetailSheetProps) {
  const t = useTranslations("members");
  const locale = useLocale();
  const canWrite = useCanAccess("users.write");
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  async function handleRoleChange(roleId: string) {
    if (!member || roleId === member.role.id) return;
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
  }

  async function handleRemove() {
    if (!member) return;
    try {
      await removeMember.mutateAsync(member.id);
      toast.success(t("toasts.removed"));
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      const isLastAdmin = detail.includes("last administrator");
      toast.error(
        isLastAdmin ? t("lastAdminGuard") : t("toasts.error"),
        !isLastAdmin && detail ? { description: detail } : undefined,
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CLASS}>
        <SheetHeader
          className="flex-row items-center gap-3 border-b border-[color:var(--orion-line-soft)] p-0"
          style={{ padding: "18px 22px" }}
        >
          {member ? (
            <span
              aria-hidden
              className="grid h-11 w-11 place-items-center rounded-full font-serif text-[15px] font-semibold text-white"
              style={{ background: avBg(member.id) }}
            >
              {initials(member.name)}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <SheetTitle className="truncate font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {member?.name ?? ""}
            </SheetTitle>
            <SheetDescription className="truncate font-mono text-[12px] text-[color:var(--orion-ink-3)]">
              {member?.email ?? ""}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: "18px 22px" }}
        >
          {member ? (
            <dl className="grid grid-cols-1 gap-[14px]">
              <div className="flex flex-col gap-1.5">
                <dt className={FIELD_LABEL_CLASS}>
                  {t("table.columns.role")}
                </dt>
                <dd>
                  <RoleSelect
                    value={member.role.id}
                    roles={roles}
                    onChange={(roleId) => void handleRoleChange(roleId)}
                    disabled={!canWrite || updateRole.isPending}
                    ariaLabel={`${t("actions.changeRole")} — ${member.name}`}
                  />
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className={FIELD_LABEL_CLASS}>
                  {t("table.columns.joinedAt")}
                </dt>
                <dd
                  className={FIELD_VALUE_CLASS}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {dateFormatter.format(new Date(member.created_at))}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>

        <SheetFooter
          className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-0 sm:justify-between"
          style={{ padding: "14px 22px" }}
        >
          {canWrite && member ? (
            <Button
              type="button"
              variant="ghost"
              className={DELETE_BUTTON_CLASS}
              onClick={() => setConfirmDelete(true)}
              disabled={removeMember.isPending}
              data-testid="member-remove"
            >
              <Trash2 size={13} strokeWidth={1.8} />
              {t("actions.remove")}
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={removeMember.isPending}
            className={CANCEL_BUTTON_CLASS}
          >
            {t("actions.close")}
          </Button>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.remove")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("actions.confirmRemove", { name: member?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
            >
              {t("actions.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
