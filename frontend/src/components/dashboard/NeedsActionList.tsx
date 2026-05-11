"use client";

import {
  AlertTriangle,
  Boxes,
  Factory,
  Scissors,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { NeedsActionItem } from "@/lib/schemas/dashboard";

type Props = { items: NeedsActionItem[] };

const KIND_META: Record<string, { icon: LucideIcon; accent: string }> = {
  orders_pending: { icon: ShoppingBag, accent: "var(--brand-sales)" },
  cutting_pending: { icon: Scissors, accent: "var(--brand-prod)" },
  sewing_open: { icon: Factory, accent: "var(--brand-prod)" },
  stock_low: { icon: Boxes, accent: "var(--brand-inv)" },
  shipment_overdue: { icon: Truck, accent: "var(--brand-prod)" },
};

export function NeedsActionList({ items }: Props) {
  const t = useTranslations("dashboard.needsAction");
  if (items.length === 0) {
    return (
      <section className="flex h-full flex-col gap-2 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5">
        <h2 className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t("title")}
        </h2>
        <p className="text-[13px] text-[color:var(--orion-ink-3)]">{t("empty")}</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5">
      <h2 className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
        {t("title")}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {items.map((item, idx) => {
          const meta = KIND_META[item.kind] ?? { icon: AlertTriangle, accent: "var(--brand-reports)" };
          const Icon = meta.icon;
          return (
            <li key={`${item.kind}-${idx}`}>
              <Link
                href={item.link}
                className="flex items-center gap-3 rounded-[8px] border border-transparent px-2 py-2 text-[13px] text-[color:var(--orion-ink-2)] transition-colors hover:border-[color:var(--orion-line-soft)] hover:bg-[color:var(--orion-bg)]"
              >
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-[6px]"
                  style={{
                    background: `color-mix(in oklab, ${meta.accent} 14%, var(--orion-surface))`,
                    color: meta.accent,
                  }}
                >
                  <Icon className="size-[14px]" strokeWidth={1.75} />
                </span>
                <span className="flex-1 truncate">{item.message}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
