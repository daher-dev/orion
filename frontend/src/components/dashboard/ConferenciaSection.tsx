"use client";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Layers,
  Package,
  PackageCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { OrderPipelineStrip } from "./OrderPipelineStrip";
import type { ConferenceSummary } from "@/lib/schemas/dashboard";

/**
 * Dashboard Conferência section (port of `dashboard.jsx` — the `ConfKPI`,
 * `ProgPanel`, `SubTile` cluster + the order pipeline). All tiles are
 * clickable and route to the surface that resolves them.
 */
export function ConferenciaSection({
  conference,
}: {
  conference: ConferenceSummary;
}) {
  const t = useTranslations("dashboard.conference");
  const router = useRouter();
  const { totals, pipeline } = conference;
  const goOrders = () => router.push("/orders");
  const goPrints = () => router.push("/prints");

  return (
    <section className="flex flex-col gap-[18px]" data-testid="dashboard-conference">
      {/* KPIs */}
      <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
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
          foot={
            totals.pending === 0 ? t("kpis.pendingNone") : t("kpis.pendingFoot")
          }
          onClick={goPrints}
        />
      </div>

      {/* Progress summary */}
      <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-[18px]">
        <div className="mb-3.5">
          <h2 className="font-serif text-[16px] text-[color:var(--orion-ink)]">
            {t("progress.title")}
          </h2>
          <p className="text-[12px] text-[color:var(--orion-ink-3)]">
            {t("progress.sub")}
          </p>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <ProgPanel
            title={t("progress.ordersDone")}
            icon={ClipboardCheck}
            color="var(--status-ok)"
            done={totals.checked}
            total={totals.orders}
            onClick={goOrders}
          />
          <ProgPanel
            title={t("progress.piecesDone")}
            icon={PackageCheck}
            color="var(--sidebar-primary)"
            done={totals.checked}
            total={totals.pieces}
            onClick={goOrders}
          />
        </div>
        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
          <SubTile
            label={t("subtiles.toCheck")}
            value={totals.to_check}
            icon={Clock}
            color="var(--orion-ink-3)"
            onClick={goOrders}
          />
          <SubTile
            label={t("subtiles.inLote")}
            value={totals.in_lote}
            icon={Layers}
            color="var(--brand-inv)"
            onClick={goOrders}
          />
          <SubTile
            label={t("subtiles.pending")}
            value={totals.pending}
            icon={AlertCircle}
            color="var(--status-warn)"
            onClick={goPrints}
          />
        </div>
      </div>

      {/* Order pipeline */}
      <OrderPipelineStrip pipeline={pipeline} />
    </section>
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

function ProgPanel({
  title,
  icon: Icon,
  color,
  done,
  total,
  onClick,
}: {
  title: string;
  icon: LucideIcon;
  color: string;
  done: number;
  total: number;
  onClick: () => void;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="conf-prog"
      className="flex flex-col rounded-[12px] border p-4 text-left"
      style={{
        background: `color-mix(in oklab, ${color} 7%, var(--orion-surface))`,
        borderColor: `color-mix(in oklab, ${color} 22%, var(--orion-surface))`,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-1.5 text-[12.5px] font-medium"
          style={{ color }}
        >
          <Icon size={15} strokeWidth={2.2} />
          {title}
        </span>
        <span className="text-[13px] font-semibold" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div
        className="mt-2 text-[13px] text-[color:var(--orion-ink-3)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <b className="text-[color:var(--orion-ink)]">{done.toLocaleString()}</b> /{" "}
        {total.toLocaleString()}
      </div>
      <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-[color:var(--orion-line-soft)]">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </button>
  );
}

function SubTile({
  label,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="conf-subtile"
      className="flex flex-col items-start rounded-[10px] border p-3 text-left"
      style={{
        background: `color-mix(in oklab, ${color} 7%, var(--orion-surface))`,
        borderColor: `color-mix(in oklab, ${color} 20%, var(--orion-surface))`,
      }}
    >
      <span
        className="flex items-center gap-1.5 text-[11.5px] font-medium"
        style={{ color }}
      >
        <Icon size={13} strokeWidth={2.2} />
        {label}
      </span>
      <div
        className="mt-1 font-serif text-[22px] text-[color:var(--orion-ink)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value.toLocaleString()}
      </div>
    </button>
  );
}
