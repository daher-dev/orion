"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteSheet } from "@/components/settings/members/InviteSheet";
import { MembersTable } from "@/components/settings/members/MembersTable";
import { PendingInvitesList } from "@/components/settings/members/PendingInvitesList";
import { useInvites } from "@/hooks/use-invites";
import { useMembers } from "@/hooks/use-members";
import { useCanAccess } from "@/hooks/use-permissions";
import { useRoles } from "@/hooks/use-roles";

export default function SettingsMembersPage() {
  const t = useTranslations("members");
  const tInvitePending = useTranslations("invite.pending");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("users.read");
  const canWrite = useCanAccess("users.write");
  const members = useMembers();
  const invites = useInvites();
  const roles = useRoles();
  const [openInvite, setOpenInvite] = useState(false);

  if (!canRead) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-10 text-center text-[color:var(--orion-ink-3)]">
        {tForbidden("members")}
      </div>
    );
  }

  return (
    <div className="grid gap-[18px]">
      <section
        className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
        data-testid="members-card"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
          <div>
            <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("list.title")}
            </div>
            <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
              {t("list.sub")}
            </div>
          </div>
          {canWrite ? (
            <Button
              type="button"
              onClick={() => setOpenInvite(true)}
              data-testid="invite-open"
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-settings)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{ borderColor: "color-mix(in oklab, var(--brand-settings) 70%, black)" }}
            >
              <Users className="size-3.5" strokeWidth={1.75} />
              {t("actions.invite")}
            </Button>
          ) : null}
        </header>

        {members.isPending ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : members.data && members.data.items.length > 0 ? (
          <MembersTable rows={members.data.items} roles={roles.data ?? []} />
        ) : (
          <div className="px-6 py-14 text-center text-[color:var(--orion-ink-3)]" data-testid="members-empty">
            <h3 className="mb-1.5 font-serif text-[17px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("list.empty.title")}
            </h3>
            <div className="mx-auto mb-3 max-w-[360px] text-[13px] leading-[1.5]">
              {t("list.empty.body")}
            </div>
            {canWrite ? (
              <Button
                type="button"
                onClick={() => setOpenInvite(true)}
                className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-settings)] !px-[13px] py-[7px] text-[13px] font-medium text-white"
                style={{ borderColor: "color-mix(in oklab, var(--brand-settings) 70%, black)" }}
              >
                <Users className="size-3.5" strokeWidth={1.75} />
                {t("list.empty.cta")}
              </Button>
            ) : null}
          </div>
        )}
      </section>

      <section
        className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
        data-testid="pending-invites-card"
      >
        <header className="border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {tInvitePending("title")}
          </div>
        </header>
        {invites.isPending ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <PendingInvitesList rows={invites.data?.items ?? []} />
        )}
      </section>

      <InviteSheet open={openInvite} onOpenChange={setOpenInvite} />
    </div>
  );
}
