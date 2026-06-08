"use client";

import { useLocale, useTranslations } from "next-intl";
import { Gauge, Building2, TrendingUp } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import { useAdminOverview } from "@/hooks/use-admin";
import { ConsoleHead } from "@/components/console-shell/ConsoleHead";
import { ConsoleButton, ConsoleCard, Metric, SoonBadge, useFormatters } from "@/components/console-shell/primitives";

export default function ConsoleOverviewPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const router = useRouter();
  const { fmtInt } = useFormatters(locale);
  const { data, isPending } = useAdminOverview();

  return (
    <div>
      <ConsoleHead
        icon={Gauge}
        eyebrow={t("nav.overview")}
        title={t("overview.title")}
        titleEm={t("overview.titleEm")}
        desc={t("overview.desc")}
        actions={
          <ConsoleButton variant="primary" onClick={() => router.push("/console/organizations")}>
            <Building2 size={13} /> {t("overview.seeOrgs")}
          </ConsoleButton>
        }
      />

      {/* Real KPIs */}
      <div className="mb-[18px] grid grid-cols-2 gap-[18px] lg:grid-cols-4">
        <Metric
          label={t("overview.kpis.organizations")}
          value={isPending ? "—" : fmtInt(data?.total_organizations ?? 0)}
          accent
          foot={t("overview.kpis.organizationsFoot")}
        />
        <Metric
          label={t("overview.kpis.operators")}
          value={isPending ? "—" : fmtInt(data?.total_operators ?? 0)}
          foot={t("overview.kpis.operatorsFoot")}
        />
        <Metric
          label={t("overview.kpis.ordersMonth")}
          value={isPending ? "—" : fmtInt(data?.orders_month ?? 0)}
          foot={t("overview.kpis.ordersMonthFoot")}
        />
        <Metric
          label={t("overview.kpis.members")}
          value={isPending ? "—" : fmtInt(data?.total_members ?? 0)}
          foot={t("overview.kpis.membersFoot")}
        />
      </div>

      {/* Revenue + plan mix — not modeled yet */}
      <div className="mb-[18px] grid gap-[18px] lg:grid-cols-[1.5fr_1fr]">
        <ConsoleCard
          title={t("overview.revenue.title")}
          sub={t("overview.revenue.sub")}
          action={<SoonBadge />}
        >
          <SoonPlaceholder icon={<TrendingUp size={22} />} text={t("overview.revenue.soon")} />
        </ConsoleCard>
        <ConsoleCard title={t("overview.planMix.title")} action={<SoonBadge />}>
          <SoonPlaceholder text={t("overview.planMix.soon")} />
        </ConsoleCard>
      </div>

      {/* Attention + activity — not modeled yet */}
      <div className="grid gap-[18px] lg:grid-cols-2">
        <ConsoleCard title={t("overview.attention.title")} action={<SoonBadge />}>
          <SoonPlaceholder text={t("overview.attention.soon")} />
        </ConsoleCard>
        <ConsoleCard title={t("overview.activity.title")} action={<SoonBadge />}>
          <SoonPlaceholder text={t("overview.activity.soon")} />
        </ConsoleCard>
      </div>
    </div>
  );
}

function SoonPlaceholder({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center text-[color:var(--orion-ink-3)]">
      {icon && <span className="text-[color:var(--console-accent)] opacity-60">{icon}</span>}
      <span className="max-w-[320px] text-[12.5px]">{text}</span>
    </div>
  );
}
