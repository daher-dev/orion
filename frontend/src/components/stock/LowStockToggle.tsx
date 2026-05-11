"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";
import { useId } from "react";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
};

/** "Apenas baixos" toggle — design mirrors the inline checkbox in inventory.jsx. */
export function LowStockToggle({ checked, onChange }: Props) {
  const t = useTranslations("stock.filters");
  const id = useId();
  return (
    <Label
      htmlFor={id}
      className="inline-flex cursor-pointer items-center gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]"
    >
      <Checkbox
        id={id}
        data-testid="low-stock-toggle"
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        className="size-3.5 rounded-[3px] border-[color:var(--orion-line)] data-[state=checked]:border-[color:var(--brand-inv)] data-[state=checked]:bg-[color:var(--brand-inv)]"
      />
      {t("lowStockOnly")}
    </Label>
  );
}
