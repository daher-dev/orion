"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Calendar, LogIn, Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminOrganization, useAdminOrgMembers } from "@/hooks/use-admin";
import {
  ConsoleButton,
  ConsoleCard,
  Meter,
  OrgMark,
  SoonBadge,
  useFormatters,
} from "@/components/console-shell/primitives";
import { useImpersonateAction } from "@/components/console-shell/useImpersonateAction";

export default function ConsoleOrgDetailPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { fmtInt } = useFormatters(locale);
  const { data: org, isPending } = useAdminOrganization(id);
  const { data: members } = useAdminOrgMembers(id);
  const [confirm, setConfirm] = useState(false);
  const impersonate = useImpersonateAction();

  if (isPending || !org) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[color:var(--orion-ink-3)]" />
      </div>
    );
  }

  const firstName = org.name.split(" ")[0];
  const created = new Date(org.created_at).toLocaleDateString(locale);

  return (
    <div className="mx-auto max-w-[1100px]">
      <button
        type="button"
        onClick={() => router.push("/console/organizations")}
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--orion-ink-3)] hover:text-[color:var(--orion-ink)]"
      >
        <ArrowLeft size={14} /> {t("nav.organizations")}
      </button>

      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <OrgMark name={org.name} accent={org.accent} size={56} />
          <div>
            <h1 className="font-serif text-[26px] font-normal tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {org.name}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12.5px] text-[color:var(--orion-ink-3)]">
              <span className="font-mono">{org.subdomain}</span>
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} /> {t("orgDetail.since", { date: created })}
              </span>
            </div>
          </div>
        </div>
        <ConsoleButton variant="primary" onClick={() => setConfirm(true)}>
          <LogIn size={13} /> {t("orgDetail.enterAs", { name: firstName })}
        </ConsoleButton>
      </div>

      <div className="grid gap-[18px] lg:grid-cols-[1fr_320px]">
        <div className="grid min-w-0 gap-[18px]">
          {/* Usage — real */}
          <ConsoleCard title={t("orgDetail.usage.title")} sub={t("orgDetail.usage.sub")}>
            <div className="grid gap-4">
              <UsageRow label={t("orgDetail.usage.ordersMonth")} value={fmtInt(org.orders_month)} cap={t("orgDetail.usage.noLimit")}>
                <Meter value={org.orders_month} cap={999999} />
              </UsageRow>
              <UsageRow label={t("orgDetail.usage.members")} value={`${org.member_count}`} cap={t("orgDetail.usage.noLimit")}>
                <Meter value={org.member_count} cap={999999} />
              </UsageRow>
            </div>
          </ConsoleCard>

          {/* Members — real */}
          <ConsoleCard
            title={t("orgDetail.members.title")}
            sub={t("orgDetail.members.count", { count: members?.total ?? 0 })}
            pad={false}
          >
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
                  <th className="px-[18px] py-2.5">{t("orgDetail.members.name")}</th>
                  <th className="px-[18px] py-2.5">{t("orgDetail.members.email")}</th>
                  <th className="px-[18px] py-2.5">{t("orgDetail.members.role")}</th>
                </tr>
              </thead>
              <tbody>
                {(members?.items ?? []).map((m) => (
                  <tr key={m.id} className="border-t border-[color:var(--orion-line-soft)]">
                    <td className="px-[18px] py-3 font-medium text-[color:var(--orion-ink)]">{m.name}</td>
                    <td className="px-[18px] py-3 font-mono text-[12px] text-[color:var(--orion-ink-2)]">{m.email}</td>
                    <td className="px-[18px] py-3 text-[color:var(--orion-ink-2)]">{m.role.name}</td>
                  </tr>
                ))}
                {(members?.items.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={3} className="px-[18px] py-8 text-center text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("orgDetail.members.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ConsoleCard>

          {/* Billing — not modeled */}
          <ConsoleCard title={t("orgDetail.billing.title")} action={<SoonBadge />}>
            <p className="text-[12.5px] text-[color:var(--orion-ink-3)]">{t("orgDetail.billing.soon")}</p>
          </ConsoleCard>

          {/* Danger zone — not wired (account pause/delete) */}
          <ConsoleCard title={t("orgDetail.danger.title")} sub={t("orgDetail.danger.sub")} action={<SoonBadge />}>
            <div className="flex items-center justify-between gap-3 py-1">
              <div>
                <div className="font-medium text-[color:var(--orion-ink)]">{t("orgDetail.danger.pause")}</div>
                <div className="text-[12px] text-[color:var(--orion-ink-3)]">{t("orgDetail.danger.pauseDesc")}</div>
              </div>
              <ConsoleButton disabled>{t("orgDetail.danger.pauseAction")}</ConsoleButton>
            </div>
            <div className="my-3 h-px bg-[color:var(--orion-line-soft)]" />
            <div className="flex items-center justify-between gap-3 py-1">
              <div>
                <div className="font-medium text-[color:var(--status-err)]">{t("orgDetail.danger.delete")}</div>
                <div className="text-[12px] text-[color:var(--orion-ink-3)]">{t("orgDetail.danger.deleteDesc")}</div>
              </div>
              <ConsoleButton variant="danger" disabled>
                {t("orgDetail.danger.deleteAction")}
              </ConsoleButton>
            </div>
          </ConsoleCard>
        </div>

        {/* Right rail */}
        <div className="grid gap-[18px]">
          <ConsoleCard title={t("orgDetail.summary.title")}>
            <dl className="grid grid-cols-2 gap-y-2.5 text-[12.5px]">
              <Dt>{t("orgDetail.summary.ordersMonth")}</Dt>
              <Dd>{fmtInt(org.orders_month)}</Dd>
              <Dt>{t("orgDetail.summary.team")}</Dt>
              <Dd>{org.member_count}</Dd>
              <Dt>{t("orgDetail.summary.subdomain")}</Dt>
              <Dd className="font-mono">{org.subdomain}</Dd>
              <Dt>{t("orgDetail.summary.created")}</Dt>
              <Dd>{created}</Dd>
            </dl>
          </ConsoleCard>

          <ConsoleCard title={t("orgDetail.changePlan.title")} action={<SoonBadge />}>
            <p className="text-[12.5px] text-[color:var(--orion-ink-3)]">{t("orgDetail.changePlan.soon")}</p>
          </ConsoleCard>

          <ConsoleCard title={t("orgDetail.integrations.title")} action={<SoonBadge />}>
            <p className="text-[12.5px] text-[color:var(--orion-ink-3)]">{t("orgDetail.integrations.soon")}</p>
          </ConsoleCard>
        </div>
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="console-scope">
          <DialogHeader>
            <DialogTitle>{t("impersonation.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("impersonation.confirmDesc", { name: org.name })}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 rounded-[10px] border border-[color:color-mix(in_oklab,var(--status-warn)_30%,var(--orion-line))] bg-[color:color-mix(in_oklab,var(--status-warn)_8%,var(--orion-surface))] p-3 text-[12.5px] text-[color:var(--orion-ink-2)]">
            <ShieldAlert size={18} className="shrink-0 text-[color:var(--status-warn)]" />
            <ul className="list-disc space-y-1.5 pl-4">
              <li>{t("impersonation.bullet1")}</li>
              <li>{t("impersonation.bullet2")}</li>
              <li>{t("impersonation.bullet3")}</li>
            </ul>
          </div>
          <DialogFooter>
            <ConsoleButton onClick={() => setConfirm(false)}>{t("common.cancel")}</ConsoleButton>
            <ConsoleButton
              variant="primary"
              disabled={impersonate.pendingId === org.id}
              onClick={() => impersonate.run(org)}
            >
              {impersonate.pendingId === org.id ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <LogIn size={13} />
              )}
              {t("orgDetail.enterAs", { name: firstName })}
            </ConsoleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsageRow({
  label,
  value,
  cap,
  children,
}: {
  label: string;
  value: string;
  cap: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12.5px] text-[color:var(--orion-ink-2)]">{label}</span>
        <span className="text-[12.5px] tabular-nums text-[color:var(--orion-ink)]">
          {value} <span className="text-[color:var(--orion-ink-3)]">/ {cap}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="text-[color:var(--orion-ink-3)]">{children}</dt>;
}
function Dd({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <dd className={`text-right font-medium text-[color:var(--orion-ink)] ${className}`}>{children}</dd>;
}
