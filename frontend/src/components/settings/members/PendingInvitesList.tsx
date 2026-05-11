"use client";

import { useMemo, useState } from "react";
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
import { useRevokeInvite } from "@/hooks/use-invites";
import { useCanAccess } from "@/hooks/use-permissions";
import type { InviteRead } from "@/lib/schemas/invite";

/**
 * Pending invites table — small `.tbl` beneath the members list.
 *
 * Filters out already-accepted invites (those don't need a "revoke" affordance).
 * Shows: email (mono) / role / sent date / expires date / revoke icon.
 */
export type PendingInvitesListProps = {
  rows: InviteRead[];
};

export function PendingInvitesList({ rows }: PendingInvitesListProps) {
  const t = useTranslations("invite.pending");
  const locale = useLocale();
  const canWrite = useCanAccess("users.write");
  const revokeInvite = useRevokeInvite();
  const [pending, setPending] = useState<InviteRead | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale],
  );

  const pendingRows = useMemo(() => rows.filter((r) => !r.accepted_at), [rows]);

  if (pendingRows.length === 0) {
    return (
      <div className="px-[20px] py-[18px] text-center text-[12.5px] italic text-[color:var(--orion-ink-3)]" data-testid="pending-empty">
        {t("empty")}
      </div>
    );
  }

  const handleConfirm = async () => {
    if (!pending) return;
    try {
      await revokeInvite.mutateAsync(pending.id);
      toast.success(t("toasts.revoked"));
      setPending(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  };

  return (
    <>
      <table className="w-full border-separate border-spacing-0 text-[13px]" data-testid="pending-invites-table">
        <thead>
          <tr>
            {(
              [
                ["email", "email"],
                ["role", "role"],
                ["sentAt", "sentAt"],
                ["expiresAt", "expiresAt"],
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
          {pendingRows.map((invite, idx) => (
            <tr
              key={invite.id}
              data-testid="pending-invite-row"
              data-invite-id={invite.id}
              data-invite-email={invite.email}
              className="hover:[&_td]:bg-[color:var(--orion-bg)]"
            >
              <td
                className={`px-[14px] py-[12px] align-middle font-mono text-[12px] text-[color:var(--orion-ink)] ${idx < pendingRows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
              >
                {invite.email}
              </td>
              <td
                className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${idx < pendingRows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
              >
                {invite.role.name}
              </td>
              <td
                className={`px-[14px] py-[12px] align-middle text-[12px] text-[color:var(--orion-ink-3)] ${idx < pendingRows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {dateFormatter.format(new Date(invite.created_at))}
              </td>
              <td
                className={`px-[14px] py-[12px] align-middle text-[12px] text-[color:var(--orion-ink-3)] ${idx < pendingRows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {dateFormatter.format(new Date(invite.expires_at))}
              </td>
              <td
                className={`px-[14px] py-[12px] align-middle text-right ${idx < pendingRows.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}`}
              >
                {canWrite ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`${t("revoke")} — ${invite.email}`}
                    data-testid="invite-revoke"
                    onClick={() => setPending(invite)}
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
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revoke")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmRevoke")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeInvite.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="invite-revoke-confirm"
              disabled={revokeInvite.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {t("revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
