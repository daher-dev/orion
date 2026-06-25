"use client";

import { useState } from "react";
import { Calendar, ChevronDown, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { GreetingHeader } from "@/components/dashboard/GreetingHeader";
import { ConferenceKpis } from "@/components/dashboard/ConferenceKpis";
import { ConferenceSummaryCard } from "@/components/dashboard/ConferenceSummaryCard";
import { TopProductsCard } from "@/components/dashboard/TopProductsCard";
import { OrderReportGrid } from "@/components/dashboard/OrderReportGrid";
import { NeedsActionList } from "@/components/dashboard/NeedsActionList";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { OperatorDashboard } from "@/components/dashboard/OperatorDashboard";
import { OrderFormSheet } from "@/components/orders/OrderFormSheet";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { useMe } from "@/hooks/use-me";
import { useCanAccess } from "@/hooks/use-permissions";

const PERIOD_OPTIONS = ["last1d", "last7d", "last30d"] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

// Maps a period option to the `days` window sent to the backend.
const PERIOD_DAYS: Record<Period, number> = {
  last1d: 1,
  last7d: 7,
  last30d: 30,
};

// .btn.btn-primary — Ember accent bg, white ink, 7 13 padding, radius
// var(--radius-sm) (6px), 13px font weight 500. Uses --sidebar-primary
// (the Ember UI accent) for the primary CTA, not the sub-product brand.
const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--sidebar-primary)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95";

// .btn (secondary) — surface bg, line border, 7 13 padding, radius 6, 13px
// font weight 500. Used here for the period dropdown trigger.
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]";

export default function HomePage() {
  const t = useTranslations("dashboard");
  const { data: me } = useMe();
  const isOperator = me?.role?.code === "operator";
  const canWrite = useCanAccess("orders.write");
  const [period, setPeriod] = useState<Period>("last7d");
  const [creating, setCreating] = useState(false);
  const { data, isPending, isError, error } = useDashboardSummary(PERIOD_DAYS[period]);

  // Operators get the factory-floor variant (cuts queue + quick actions).
  if (isOperator) {
    return (
      <OperatorDashboard
        operator={data?.operator}
        isPending={isPending}
        isError={isError}
        errorMessage={error?.detail ?? t("loadError")}
      />
    );
  }

  return (
    // Vertical stack — 18px gap between major blocks mirrors the design source
    // (`marginBottom: 18` between cards in docs/design/pages/dashboard.jsx).
    <div className="flex flex-col gap-[18px]">
      <GreetingHeader
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Period selector — design source renders a single secondary
                `.btn` with calendar icon + "Últimos 30 dias". Keeping it
                interactive via DropdownMenu so users can flip between
                7/30/90d windows without leaving the page. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={SECONDARY_BUTTON_CLASS}>
                  <Calendar size={14} strokeWidth={1.8} />
                  {t(`filters.${period}`)}
                  <ChevronDown
                    size={12}
                    strokeWidth={2}
                    className="text-[color:var(--orion-ink-3)]"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PERIOD_OPTIONS.map((p) => (
                  <DropdownMenuItem
                    key={p}
                    onSelect={() => setPeriod(p)}
                    data-active={p === period || undefined}
                  >
                    {t(`filters.${p}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {canWrite ? (
              <Button
                type="button"
                onClick={() => setCreating(true)}
                className={PRIMARY_BUTTON_CLASS}
                style={{
                  borderColor:
                    "color-mix(in oklab, var(--sidebar-primary) 70%, black)",
                }}
              >
                <ShoppingBag size={14} strokeWidth={1.8} />
                {t("actions.newOrder")}
              </Button>
            ) : null}
          </div>
        }
      />

      {isPending ? (
        <div className="flex flex-col gap-[18px]">
          <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[118px] rounded-[14px]" />
            ))}
          </div>
          <div className="grid gap-[18px] lg:grid-cols-[1.45fr_1fr]">
            <Skeleton className="h-[260px] rounded-[14px]" />
            <Skeleton className="h-[260px] rounded-[14px]" />
          </div>
          <Skeleton className="h-[190px] rounded-[14px]" />
          <div className="grid gap-[18px] lg:grid-cols-2">
            <Skeleton className="h-[260px] rounded-[14px]" />
            <Skeleton className="h-[260px] rounded-[14px]" />
          </div>
        </div>
      ) : isError ? (
        <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
          {error?.detail ?? t("loadError")}
        </div>
      ) : data ? (
        // Order mirrors docs/design/pages/dashboard.jsx exactly:
        //   1. Conference KPIs (4, full width)
        //   2. [Resumo da conferência | Top 5 produtos] (2-col)
        //   3. Relatório de pedidos (full width)
        //   4. [Precisa da sua atenção | Atividade recente] (2-col)
        <>
          <ConferenceKpis totals={data.conference.totals} />
          <div className="grid gap-[18px] lg:grid-cols-[1.45fr_1fr]">
            <ConferenceSummaryCard totals={data.conference.totals} />
            <TopProductsCard items={data.top_products} />
          </div>
          <OrderReportGrid totals={data.conference.totals} />
          <div className="grid gap-[18px] lg:grid-cols-2">
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
