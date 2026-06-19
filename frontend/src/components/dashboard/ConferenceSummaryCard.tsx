"use client";

import {
  AlertTriangle,
  CircleDashed,
  ClipboardCheck,
  Clock,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { ConferenceTotals } from "@/lib/schemas/dashboard";

/**
 * "Resumo da conferência" — two progress panels (orders / pieces checked) plus
 * three actionable sub-tiles (Parciais / Problemas / A conferir). Port of the
 * `<Card title="Resumo da conferência">` block in dashboard.jsx.
 */
export function ConferenceSummaryCard({ totals }: { totals: ConferenceTotals }) {
  const t = useTranslations("dashboard.conference");
  const router = useRouter();
  const goOrders = () => router.push("/orders");

  return (
    <section
      className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-[18px]"
      data-testid="conference-summary"
    >
      <div className="mb-3.5">
        <h2 className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t("progress.title")}
        </h2>
        <p className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
          {t("progress.sub")}
        </p>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <ProgPanel
          title={t("progress.ordersDone")}
          icon={ClipboardCheck}
          color="var(--status-ok)"
          done={totals.orders_checked}
          total={totals.orders}
          onClick={goOrders}
        />
        <ProgPanel
          title={t("progress.piecesDone")}
          icon={PackageCheck}
          color="var(--sidebar-primary)"
          done={totals.pieces_checked}
          total={totals.pieces}
          onClick={goOrders}
        />
      </div>

      <div className="mt-3.5 grid gap-2.5 sm:grid-cols-3">
        <SubTile
          label={t("subtiles.partial")}
          value={totals.orders_partial}
          icon={CircleDashed}
          color="var(--status-warn)"
          onClick={goOrders}
        />
        {/*
          "Problemas" (divergências) has no source in the data model yet —
          SeparationStatus is only pending/label_printed/checked. Rendered as a
          0 stub to preserve the design's three-tile layout; wiring it needs a
          divergence concept (see the plan).
        */}
        <SubTile
          label={t("subtiles.problems")}
          value={0}
          icon={AlertTriangle}
          color="var(--status-err)"
          onClick={goOrders}
        />
        <SubTile
          label={t("subtiles.toCheck")}
          value={totals.orders_untouched}
          icon={Clock}
          color="var(--orion-ink-3)"
          onClick={goOrders}
        />
      </div>
    </section>
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
