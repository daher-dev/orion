"use client";

import { useState } from "react";
import { Plus, Shirt, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { GarmentGlyph } from "@/components/ui/garment-glyph";
import type { ProductType } from "@/lib/schemas/product";
import type { GarmentTypeEntry } from "@/lib/schemas/company-settings";

type Props = {
  types: GarmentTypeEntry[];
  onChange: (next: GarmentTypeEntry[]) => void;
  disabled?: boolean;
};

/**
 * Selectable garment-glyph icons. Keys are the free-text `icon` value stored on
 * each garment type (the seed config uses "camiseta", "moletom", … which map to
 * the design glyphs). Unknown icons fall back to a generic Shirt at render time.
 */
const ICON_OPTIONS: { key: string; glyph: ProductType }[] = [
  { key: "camiseta", glyph: "tshirt" },
  { key: "moletom", glyph: "sweatshirt" },
  { key: "regata", glyph: "tanktop" },
  { key: "bermuda", glyph: "shorts" },
];

const GLYPH_BY_KEY: Record<string, ProductType> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.key, o.glyph]),
);

function GarmentTypeGlyph({ icon, size = 19 }: { icon: string; size?: number }) {
  const glyph = GLYPH_BY_KEY[icon];
  if (glyph) return <GarmentGlyph productType={glyph} size={size} />;
  const Fallback: LucideIcon = Shirt;
  return <Fallback size={size} strokeWidth={1.6} />;
}

function IconChooser({
  value,
  onChange,
  disabled,
  index,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  index: number;
}) {
  const t = useTranslations("catalogConfig.garmentTypes");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t("chooseIcon")}
          disabled={disabled}
          data-testid={`garment-icon-${index}`}
          className={cn(
            "grid size-[38px] shrink-0 place-items-center rounded-[9px] border bg-[color:var(--orion-surface)] text-[color:var(--orion-ink)]",
            open
              ? "border-[color:var(--brand-settings)] bg-[color:var(--orion-surface-2)]"
              : "border-[color:var(--orion-line)]",
          )}
        >
          <GarmentTypeGlyph icon={value} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-4 gap-1">
          {ICON_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              title={o.key}
              data-testid={`garment-icon-option-${o.key}`}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              className={cn(
                "grid size-9 place-items-center rounded-[8px] border text-[color:var(--orion-ink-2)]",
                o.key === value
                  ? "border-[color:var(--brand-settings)] bg-[color:var(--orion-surface-2)]"
                  : "border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)]",
              )}
            >
              <GarmentGlyph productType={o.glyph} size={18} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Editor for the configurable "garment type" — icon + label + SKU prefix.
 * Port of `GarmentTypesEditor` from docs/design/pages/settings.jsx. The SKU
 * prefix is normalized to uppercase A-Z0-9, max 4 chars.
 */
export function GarmentTypesEditor({ types, onChange, disabled }: Props) {
  const t = useTranslations("catalogConfig.garmentTypes");
  const update = (i: number, patch: Partial<GarmentTypeEntry>) =>
    onChange(types.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = (i: number) => onChange(types.filter((_, j) => j !== i));
  const add = () =>
    onChange([
      ...types,
      {
        id: `tipo-${Date.now().toString(36)}`,
        label: "",
        skuPrefix: "",
        icon: "camiseta",
      },
    ]);

  return (
    <div>
      <div className="grid gap-2">
        <div className="grid grid-cols-[38px_1fr_96px_30px] gap-2.5 px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
          <span>{t("colIcon")}</span>
          <span>{t("colName")}</span>
          <span>{t("colSku")}</span>
          <span />
        </div>
        {types.map((tp, i) => (
          <div
            key={tp.id}
            data-testid="garment-row"
            className="grid grid-cols-[38px_1fr_96px_30px] items-center gap-2.5"
          >
            <IconChooser
              value={tp.icon}
              index={i}
              disabled={disabled}
              onChange={(v) => update(i, { icon: v })}
            />
            <Input
              value={tp.label}
              placeholder={t("namePlaceholder")}
              disabled={disabled}
              onChange={(e) => update(i, { label: e.target.value })}
              data-testid={`garment-label-${i}`}
              className="h-[38px] min-w-0 rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[11px] text-[13px] text-[color:var(--orion-ink)] shadow-none"
            />
            <Input
              value={tp.skuPrefix}
              placeholder={t("skuPlaceholder")}
              maxLength={4}
              disabled={disabled}
              onChange={(e) =>
                update(i, {
                  skuPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                })
              }
              data-testid={`garment-sku-${i}`}
              className="h-[38px] min-w-0 rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[11px] text-center font-mono text-[12.5px] tracking-[0.06em] text-[color:var(--orion-ink)] shadow-none"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={t("add")}
              disabled={disabled || types.length <= 1}
              onClick={() => remove(i)}
              data-testid={`garment-remove-${i}`}
              className="size-7 text-[color:var(--orion-ink-3)]"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        disabled={disabled}
        data-testid="garment-add"
        className="mt-3 gap-1.5"
      >
        <Plus className="size-3.5" /> {t("add")}
      </Button>
    </div>
  );
}
