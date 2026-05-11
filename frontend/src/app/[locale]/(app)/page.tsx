"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { ProductionPipeline } from "@/components/dashboard/ProductionPipeline";
import { NeedsActionList } from "@/components/dashboard/NeedsActionList";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { useDashboardSummary } from "@/hooks/use-dashboard";

export default function HomePage() {
  const t = useTranslations("dashboard");
  const { data, isPending, isError, error } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-5">
      <GreetingHeader />

      {isPending ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[112px] rounded-[14px]" />
            ))}
          </div>
          <Skeleton className="h-[120px] rounded-[14px]" />
        </div>
      ) : isError ? (
        <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
          {error?.detail ?? t("loadError")}
        </div>
      ) : data ? (
        <>
          <KpiStrip kpis={data.kpis} />
          <ProductionPipeline pipeline={data.pipeline} />
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <NeedsActionList items={data.needs_action} />
            <ActivityFeed items={data.activity} />
          </div>
        </>
      ) : null}
    </div>
  );
}
