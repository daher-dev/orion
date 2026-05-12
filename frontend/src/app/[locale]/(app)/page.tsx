"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { ProductionPipeline } from "@/components/dashboard/ProductionPipeline";
import { NeedsActionList } from "@/components/dashboard/NeedsActionList";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { RevenueByChannelChart } from "@/components/dashboard/RevenueByChannelChart";
import { OrderFormSheet } from "@/components/orders/OrderFormSheet";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { useCanAccess } from "@/hooks/use-permissions";

const PERIOD_OPTIONS = ["last7d", "last30d", "last90d"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95";

export default function HomePage() {
  const t = useTranslations("dashboard");
  const canWrite = useCanAccess("orders.write");
  const [period, setPeriod] = useState<Period>("last30d");
  const [creating, setCreating] = useState(false);
  const { data, isPending, isError, error } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-5">
      <GreetingHeader
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-auto min-w-[148px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`filters.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canWrite ? (
              <Button
                type="button"
                onClick={() => setCreating(true)}
                className={PRIMARY_BUTTON_CLASS}
                style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
              >
                <ShoppingBag size={14} strokeWidth={1.8} />
                {t("actions.newOrder")}
              </Button>
            ) : null}
          </div>
        }
      />

      {isPending ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[112px] rounded-[14px]" />
            ))}
          </div>
          <Skeleton className="h-[120px] rounded-[14px]" />
          <Skeleton className="h-[180px] rounded-[14px]" />
        </div>
      ) : isError ? (
        <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
          {error?.detail ?? t("loadError")}
        </div>
      ) : data ? (
        <>
          <KpiStrip kpis={data.kpis} />
          <ProductionPipeline pipeline={data.pipeline} />
          <RevenueByChannelChart items={data.revenue_by_channel} />
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <NeedsActionList items={data.needs_action} />
            <ActivityFeed items={data.activity} />
          </div>
        </>
      ) : null}

      {canWrite ? (
        <OrderFormSheet open={creating} onOpenChange={setCreating} navigateOnCreate />
      ) : null}
    </div>
  );
}
