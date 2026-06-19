"use client";

import {
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  PackageCheck,
  Scissors,
  Send,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { CuttingStatusPill } from "@/components/cutting/CuttingStatusPill";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";
import type { CuttingStatus } from "@/lib/schemas/cutting";
import type { OperatorCut, OperatorSummary } from "@/lib/schemas/dashboard";

function periodKey(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

type Props = {
  operator?: OperatorSummary;
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
};

/**
 * Operator (factory-floor) dashboard — shown when the user's role is
 * `operator`. Port of the `OperatorDashboard` variant in dashboard.jsx: a
 * focused greeting, three floor KPIs, the cutting queue, and quick actions.
 */
export function OperatorDashboard({ operator, isPending, isError, errorMessage }: Props) {
  const t = useTranslations("dashboard");
  const { data } = useMe();
  const firstName = (data?.user?.name ?? data?.user?.email ?? "").split(/\s+/)[0];
  const period = periodKey(new Date().getHours());

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHead
        subColor="var(--brand-prod)"
        mark={<LayoutDashboard size={11} strokeWidth={2.2} />}
        eyebrow={t("eyebrow")}
        title={firstName ? `${t(`greetings.${period}`)},` : t(`greetings.${period}`)}
        titleEm={firstName || undefined}
        sub={t("operator.sub")}
        help={{
          icon: ClipboardCheck,
          tone: "var(--brand-prod)",
          title: t("operator.help.title"),
          body: t.rich("operator.help.body", helpBodyTags),
          steps: [
            {
              icon: Scissors,
              label: t("operator.help.flow.cut"),
              sub: t("operator.help.flow.cutSub"),
              tone: "accent",
            },
            {
              icon: Send,
              label: t("operator.help.flow.sew"),
              sub: t("operator.help.flow.sewSub"),
            },
            {
              icon: PackageCheck,
              label: t("operator.help.flow.deliver"),
              sub: t("operator.help.flow.deliverSub"),
              tone: "ok",
            },
          ],
        }}
      />

      {isPending ? (
        <OperatorSkeleton />
      ) : isError ? (
        <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6 text-[13px] text-[color:var(--orion-ink-3)]">
          {errorMessage}
        </div>
      ) : operator ? (
        <>
          <div className="grid gap-[14px] sm:grid-cols-3" data-testid="operator-kpis">
            <OperatorKpi
              label={t("operator.kpis.queue")}
              value={operator.cuts_in_queue}
              sub={t("operator.kpis.queueSub")}
            />
            <OperatorKpi
              label={t("operator.kpis.incoming")}
              value={operator.shipments_incoming}
              sub={t("operator.kpis.incomingSub")}
            />
            <OperatorKpi
              label={t("operator.kpis.today")}
              value={operator.pieces_today}
              sub={t("operator.kpis.todaySub")}
            />
          </div>

          <div className="grid gap-[18px] lg:grid-cols-2">
            <QueueCard items={operator.cutting_queue} />
            <QuickActionsCard />
          </div>
        </>
      ) : null}
    </div>
  );
}

function OperatorKpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
        {label}
      </span>
      <div
        className="font-serif text-[30px] leading-none text-[color:var(--orion-ink)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-[12px] text-[color:var(--orion-ink-3)]">{sub}</div>
    </div>
  );
}

function QueueCard({ items }: { items: OperatorCut[] }) {
  const t = useTranslations("dashboard.operator");
  return (
    <section
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="operator-queue"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t("queueTitle")}
        </div>
        <Link
          href="/cutting"
          className="inline-flex items-center gap-1 rounded-[5px] px-[9px] py-[4px] text-[12px] font-medium text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
        >
          {t("queueAll")}
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="px-[18px] py-[28px] text-center text-[13px] text-[color:var(--orion-ink-3)]">
          {t("queueEmpty")}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0 py-[4px]">
          {items.map((cut, idx) => (
            <li key={cut.id}>
              <div
                className={
                  "flex items-center gap-3 px-[18px] py-[12px] " +
                  (idx === items.length - 1
                    ? ""
                    : "border-b border-[color:var(--orion-line-soft)]")
                }
              >
                <span
                  className="text-[12px] text-[color:var(--orion-ink-3)]"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {cut.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--orion-ink)]">
                  {cut.color}
                </span>
                <CuttingStatusPill status={cut.status as CuttingStatus} />
                <Link
                  href="/cutting"
                  className="inline-flex items-center gap-1 rounded-[5px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[9px] py-[4px] text-[12px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]"
                >
                  {t("open")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickActionsCard() {
  const t = useTranslations("dashboard.operator");
  const actions = [
    { href: "/cutting", icon: Scissors, label: t("quickActions.registerCut") },
    { href: "/sewing", icon: PackageCheck, label: t("quickActions.receiveShipment") },
    { href: "/stock", icon: Boxes, label: t("quickActions.adjustStock") },
  ] as const;
  return (
    <section className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      <div className="flex items-center gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t("quickActions.title")}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-[18px]">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex items-center gap-2 rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[14px] py-[10px] text-[13px] font-medium text-[color:var(--orion-ink)] transition-colors hover:bg-[color:var(--orion-surface-2)]"
            >
              <Icon size={14} strokeWidth={1.8} />
              {action.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function OperatorSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid gap-[14px] sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-[14px]" />
        ))}
      </div>
      <div className="grid gap-[18px] lg:grid-cols-2">
        <Skeleton className="h-[240px] rounded-[14px]" />
        <Skeleton className="h-[240px] rounded-[14px]" />
      </div>
    </div>
  );
}
