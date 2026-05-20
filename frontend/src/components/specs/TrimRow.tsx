"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberInput } from "@/components/ui/number-input";
import { TRIM_TYPES, type TrimType } from "@/lib/schemas/spec";

export type TrimRowValue = {
  trim_type: TrimType;
  unit_price: string;
  quantity: number;
};

/**
 * A single row inside the trims editor — type / qty / unit_price / remove.
 *
 * Layout matches the design: a 3-column grid `1fr 110px 28px`, gap 8.
 * The remove button is a ghost icon button. The trim_type select is a
 * shadcn Select wrapper (no raw <select>).
 */
export function TrimRow({
  index,
  value,
  onChange,
  onRemove,
}: {
  index: number;
  value: TrimRowValue;
  onChange: (next: TrimRowValue) => void;
  onRemove: () => void;
}) {
  const t = useTranslations();

  return (
    <div
      data-testid="trim-row"
      className="grid items-center gap-2"
      style={{ gridTemplateColumns: "1fr 96px 136px 28px" }}
    >
      <Select
        value={value.trim_type}
        onValueChange={(next) => onChange({ ...value, trim_type: next as TrimType })}
      >
        <SelectTrigger
          aria-label={t("specs.form.labels.trimType")}
          className="w-full"
          data-testid={`trim-row-${index}-type`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRIM_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {t(`specs.trimTypes.${type}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <NumberInput
        tone="catalog"
        step={1}
        min={1}
        decimals={0}
        align="right"
        aria-label={t("specs.form.labels.trimQty")}
        value={value.quantity}
        onChange={(next) => onChange({ ...value, quantity: Number(next) || 1 })}
        data-testid={`trim-row-${index}-qty`}
      />
      <NumberInput
        tone="catalog"
        prefix="R$"
        step={0.01}
        min={0}
        decimals={2}
        align="right"
        aria-label={t("specs.form.labels.trimUnitPrice")}
        value={value.unit_price}
        onChange={(next) => onChange({ ...value, unit_price: next })}
        data-testid={`trim-row-${index}-price`}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("specs.actions.removeTrim")}
        className="grid size-7 place-items-center rounded-md text-[color:var(--orion-ink-3)] transition-colors hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
        data-testid={`trim-row-${index}-remove`}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
