"use client";

import { useTranslations } from "next-intl";
import type { ReportDateRange } from "@/lib/schemas/reports";
import { SalesTab } from "@/components/reports/SalesTab";
import { ProductionTab } from "@/components/reports/ProductionTab";
import { InventoryTab } from "@/components/reports/InventoryTab";
import { CostsTab } from "@/components/reports/CostsTab";
import { TurnoverTab } from "@/components/reports/TurnoverTab";

type TabId = "sales" | "production" | "inventory" | "costs" | "turnover";

type Props = {
  /** Current selected tab id. */
  value: string;
  onValueChange: (v: string) => void;
  range: ReportDateRange;
};

/**
 * 4-tab switcher for the Reports page. Direct port of the `<Seg/>` segmented
 * control from `/docs/design/source/ui.jsx` + `.seg` rules in styles.css:
 *
 *  - inline-flex pill group, `--orion-bg` background, `--orion-line` border,
 *    8px radius, 2px interior padding, 2px gap between buttons.
 *  - Each button: 6/12 padding, 12.5px text, ink-3 idle, ink-2 on hover.
 *  - Active button: `--orion-surface` bg, ink color, soft drop shadow,
 *    weight 500.
 */
export function ReportTabs({ value, onValueChange, range }: Props) {
  const t = useTranslations("reports.tabs");
  const tPage = useTranslations("reports.page");

  const options: { value: TabId; label: string }[] = [
    { value: "sales", label: t("sales") },
    { value: "production", label: t("production") },
    { value: "inventory", label: t("inventory") },
    { value: "costs", label: t("costs") },
    { value: "turnover", label: t("turnover") },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* mb-16 in the design source — collapsed into the surrounding flex gap. */}
      <div
        role="tablist"
        aria-label={tPage("eyebrow")}
        className="inline-flex w-fit gap-[2px] rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] p-[2px]"
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onValueChange(opt.value)}
              data-state={active ? "active" : "inactive"}
              className={[
                "rounded-[6px] px-[12px] py-[6px] text-[12.5px] transition-colors",
                active
                  ? "bg-[color:var(--orion-surface)] font-medium text-[color:var(--orion-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "bg-transparent text-[color:var(--orion-ink-3)] hover:text-[color:var(--orion-ink-2)]",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {value === "sales" && <SalesTab range={range} />}
        {value === "production" && <ProductionTab range={range} />}
        {value === "inventory" && <InventoryTab range={range} />}
        {value === "costs" && <CostsTab range={range} />}
        {value === "turnover" && <TurnoverTab range={range} />}
      </div>
    </div>
  );
}
