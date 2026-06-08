"use client";

import { useTranslations } from "next-intl";
import { Users, UserPlus, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminOperators } from "@/hooks/use-admin";
import { ConsoleHead } from "@/components/console-shell/ConsoleHead";
import { ConsoleButton, Metric, SoonBadge } from "@/components/console-shell/primitives";

export default function ConsoleUsersPage() {
  const t = useTranslations("console");
  const { data, isPending } = useAdminOperators();
  const items = data?.items ?? [];

  return (
    <div>
      <ConsoleHead
        icon={Users}
        color="#0f766e"
        eyebrow={t("nav.platform")}
        title={t("users.title")}
        titleEm={t("users.titleEm")}
        desc={t("users.desc")}
        actions={
          <ConsoleButton
            variant="primary"
            onClick={() => toast.info(t("users.inviteSoon"))}
          >
            <UserPlus size={13} /> {t("users.invite")}
          </ConsoleButton>
        }
      />

      <div className="mb-[18px] grid grid-cols-2 gap-[18px] lg:grid-cols-4">
        <Metric label={t("users.kpis.members")} value={isPending ? "—" : items.length} foot={t("users.kpis.membersFoot")} />
        <Metric label={t("users.kpis.active")} value={isPending ? "—" : items.length} />
        <Metric label={t("users.kpis.invites")} value="—" soon />
        <Metric label={t("users.kpis.twofa")} value="—" soon />
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
              <th className="px-[18px] py-2.5">{t("users.cols.member")}</th>
              <th className="px-[18px] py-2.5">{t("users.cols.role")}</th>
              <th className="px-[18px] py-2.5">{t("users.cols.company")}</th>
              <th className="px-[18px] py-2.5">
                {t("users.cols.twofa")} <SoonBadge />
              </th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={4} className="px-[18px] py-10 text-center text-[color:var(--orion-ink-3)]">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-[18px] py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
                  {t("users.empty")}
                </td>
              </tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="border-t border-[color:var(--orion-line-soft)]">
                  <td className="px-[18px] py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 place-items-center rounded-full bg-[color:var(--console-accent)] text-[12px] font-semibold text-white">
                        {u.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <div className="font-medium whitespace-nowrap text-[color:var(--orion-ink)]">{u.name}</div>
                        <div className="font-mono text-[11.5px] text-[color:var(--orion-ink-3)]">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-[18px] py-3 text-[color:var(--orion-ink-2)]">{u.role_name}</td>
                  <td className="px-[18px] py-3 text-[color:var(--orion-ink-2)]">{u.company_name}</td>
                  <td className="px-[18px] py-3 text-[12px] text-[color:var(--orion-ink-3)]">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 px-1 pt-3.5 text-[12px] text-[color:var(--orion-ink-3)]">
        <Info size={12} />
        {t("users.hint")}
      </div>
    </div>
  );
}
