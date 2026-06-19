"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Package,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { ConferenceTotals } from "@/lib/schemas/dashboard";

/**
 * The four actionable conference KPIs — the dashboard's top strip (port of the
 * `ConfKPI` `.grid.g-cols-4` block in docs/design/pages/dashboard.jsx). Every
 * tile is clickable and routes to the surface that resolves it.
 */
export function ConferenceKpis({ totals }: { totals: ConferenceTotals }) {
  const t = useTranslations("dashboard.conference");
  const router = useRouter();
  const goOrders = () => router.push("/orders");
  const goPrints = () => router.push("/prints");

  return (
    <div
      className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4"
      data-testid="conference-kpis"
    >
      <ConfKpi
        label={t("kpis.orders")}
        value={totals.orders}
        icon={FileText}
        color="var(--sidebar-primary)"
        foot={t("kpis.ordersFoot")}
        onClick={goOrders}
      />
      <ConfKpi
        label={t("kpis.pieces")}
        value={totals.pieces}
        icon={Package}
        color="var(--brand-catalog)"
        foot={t("kpis.piecesFoot", { count: totals.orders })}
        onClick={goOrders}
      />
      <ConfKpi
        label={t("kpis.mapped")}
        value={totals.mapped_pct}
        suffix="%"
        icon={CheckCircle2}
        color="var(--status-ok)"
        foot={t("kpis.mappedFoot")}
        onClick={goPrints}
      />
      <ConfKpi
        label={t("kpis.pending")}
        value={totals.pending}
        icon={AlertCircle}
        color="var(--status-warn)"
        foot={totals.pending === 0 ? t("kpis.pendingNone") : t("kpis.pendingFoot")}
        onClick={goPrints}
      />
    </div>
  );
}

function ConfKpi({
  label,
  value,
  suffix,
  icon: Icon,
  color,
  foot,
  onClick,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  color: string;
  foot: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="conf-kpi"
      className="flex flex-col rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-[16px] text-left transition-colors hover:bg-[color:var(--orion-surface-2)]"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
          {label}
        </span>
        <span
          className="grid h-7 w-7 place-items-center rounded-[8px]"
          style={{
            background: `color-mix(in oklab, ${color} 15%, var(--orion-surface))`,
            color,
          }}
        >
          <Icon size={16} strokeWidth={2.2} />
        </span>
      </div>
      <div
        className="mt-2 font-serif text-[30px] leading-none text-[color:var(--orion-ink)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value.toLocaleString()}
        {suffix ? (
          <span className="text-[20px] text-[color:var(--orion-ink-3)]">{suffix}</span>
        ) : null}
      </div>
      <div className="mt-1.5 text-[11.5px] text-[color:var(--orion-ink-3)]">{foot}</div>
    </button>
  );
}
