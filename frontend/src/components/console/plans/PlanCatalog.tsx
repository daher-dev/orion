"use client";

import { useLocale, useTranslations } from "next-intl";
import { useFormatters } from "@/components/console-shell/primitives";
import type { PlanRead } from "@/lib/schemas/billing";

/**
 * Console plan catalog — the 4-card grid from docs/design/admin/plans.jsx,
 * driven by real plan data from `GET /v1/admin/plans`.
 *
 * Each card shows the plan accent stripe, name, tagline, price (or "Free"),
 * and the four monthly limits (members / orders / integrations / storage),
 * with `null` limits rendered as "Unlimited". Per-plan org counts and MRR are
 * intentionally omitted — Orion does not track subscriptions-per-plan yet, so
 * the catalog stays a read-only list of plans and their limits rather than
 * fabricating economics.
 */

// Stable per-slug accent colors matching the design's --plan-* tokens.
const PLAN_ACCENT: Record<string, string> = {
  free: "var(--plan-gratis)",
  gratis: "var(--plan-gratis)",
  atelie: "var(--plan-atelie)",
  pro: "var(--plan-pro)",
  fabrica: "var(--plan-fabrica)",
};
const FALLBACK_ACCENT = "var(--console-accent)";

type Props = {
  plans: readonly PlanRead[];
};

export function PlanCatalog({ plans }: Props) {
  const t = useTranslations("console.plans");
  const locale = useLocale();
  const { fmtBRL, fmtInt } = useFormatters(locale);

  const fmtLimit = (value: number | null, kind: "plain" | "orders" | "storage") => {
    if (value === null) return t("unlimited");
    if (kind === "orders") return t("ordersPerMonth", { count: fmtInt(value) });
    if (kind === "storage") return t("storageGb", { count: fmtInt(value) });
    return fmtInt(value);
  };

  if (plans.length === 0) {
    return (
      <div
        className="rounded-[14px] border border-dashed border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-10 text-center text-[13px] text-[color:var(--orion-ink-3)]"
        data-testid="plan-catalog-empty"
      >
        {t("empty")}
      </div>
    );
  }

  return (
    <div
      className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4"
      data-testid="plan-catalog"
    >
      {plans.map((p) => {
        const accent = PLAN_ACCENT[p.slug] ?? FALLBACK_ACCENT;
        const limitRows: [string, string][] = [
          [t("limit.members"), fmtLimit(p.max_members, "plain")],
          [t("limit.orders"), fmtLimit(p.max_orders_per_month, "orders")],
          [t("limit.integrations"), fmtLimit(p.max_integrations, "plain")],
          [t("limit.storage"), fmtLimit(p.max_storage_gb, "storage")],
        ];
        return (
          <div
            key={p.id}
            className="flex flex-col overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
            data-testid="plan-card"
            data-slug={p.slug}
          >
            <div style={{ height: 4, background: accent }} />
            <div className="flex flex-1 flex-col gap-3.5 p-[18px]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: accent }} />
                  <span className="font-serif text-[20px] font-medium text-[color:var(--orion-ink)]">
                    {p.name}
                  </span>
                </div>
                {p.tagline && (
                  <div className="mt-1 text-[12px] text-[color:var(--orion-ink-3)]">{p.tagline}</div>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-[32px] font-normal tracking-[-0.02em] text-[color:var(--orion-ink)]">
                  {p.price === 0 ? t("free") : fmtBRL(p.price)}
                </span>
                {p.price > 0 && (
                  <span className="text-[12.5px] text-[color:var(--orion-ink-3)]">{t("perMonth")}</span>
                )}
              </div>
              <div className="mt-1 grid gap-2">
                {limitRows.map(([label, value]) => (
                  <div key={label} className="flex justify-between text-[12.5px]">
                    <span className="text-[color:var(--orion-ink-3)]">{label}</span>
                    <span className="font-medium text-[color:var(--orion-ink-2)]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
