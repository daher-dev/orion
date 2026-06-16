"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PrintSide } from "@/lib/schemas/print";

type Props = {
  hasFront: boolean;
  hasBack: boolean;
  disabled?: boolean;
  onToggle: (side: PrintSide, enabled: boolean) => void;
};

/**
 * Print-level sides selector. Sides are a property of the estampa (every color
 * carries the same sides), driving `has_front`/`has_back`. At least one side
 * must stay enabled. Port of the "Lados" control from
 * docs/design/pages/catalog.jsx.
 */
export function SidesSelector({ hasFront, hasBack, disabled, onToggle }: Props) {
  const t = useTranslations("prints.sides");
  const enabled: { side: PrintSide; on: boolean }[] = [
    { side: "front", on: hasFront },
    { side: "back", on: hasBack },
  ];
  const activeCount = (hasFront ? 1 : 0) + (hasBack ? 1 : 0);

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-[9px] bg-[color:var(--orion-surface-2)] px-[11px] py-[9px]"
      data-testid="sides-selector"
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
        {t("label")}
      </span>
      {enabled
        .filter((s) => s.on)
        .map((s) => (
          <span
            key={s.side}
            data-testid={`side-chip-${s.side}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] py-[3px] pl-2.5 pr-[5px] text-[12px] font-medium text-[color:var(--orion-ink)]"
          >
            {t(s.side)}
            <button
              type="button"
              disabled={disabled || activeCount <= 1}
              onClick={() => onToggle(s.side, false)}
              title={s.side === "front" ? t("removeFront") : t("removeBack")}
              data-testid={`side-remove-${s.side}`}
              className={cn(
                "grid size-[17px] place-items-center rounded-full text-[color:var(--orion-ink-3)]",
                disabled || activeCount <= 1 ? "cursor-not-allowed opacity-40" : "hover:text-[color:var(--orion-ink)]",
              )}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      {enabled
        .filter((s) => !s.on)
        .map((s) => (
          <Button
            key={s.side}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onToggle(s.side, true)}
            data-testid={`side-add-${s.side}`}
            className="h-auto gap-1 px-2 py-[3px] text-[12px] text-[color:var(--brand-catalog)]"
          >
            <Plus className="size-3" /> {t(s.side)}
          </Button>
        ))}
    </div>
  );
}
