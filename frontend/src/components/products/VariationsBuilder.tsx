"use client";

import { useMemo } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SIZES, type Size, type VariationItem } from "@/lib/schemas/product";

export type ColorRow = {
  name: string;
  hex?: string;
  color_code: string;
};

export type VariationsBuilderValue = {
  sizes: Size[];
  colors: ColorRow[];
};

type Props = {
  value: VariationsBuilderValue;
  onChange: (next: VariationsBuilderValue) => void;
  specCode?: string | null;
  printCode?: string | null;
};

const DEFAULT_PALETTE: { hex: string; name: string; code: string }[] = [
  { hex: "#1f1f1f", name: "Preto", code: "PRT" },
  { hex: "#f4f1ea", name: "Off-white", code: "OFF" },
  { hex: "#7a4b2a", name: "Marrom", code: "MAR" },
  { hex: "#c9b9a3", name: "Areia", code: "ARE" },
  { hex: "#7a8a76", name: "Verde-musgo", code: "MUS" },
  { hex: "#b03a2e", name: "Vermelho", code: "VRM" },
  { hex: "#2a3b5a", name: "Azul-marinho", code: "AZM" },
];

/**
 * Interactive variation matrix builder.
 *
 *   rows = sizes (P/M/G/GG toggle buttons)
 *   cols = colors (user adds — name + 3-letter code + optional swatch)
 *
 * The control's value is the cross product (sizes × colors). The parent
 * derives the actual `variations[]` list from this — every (size, color)
 * pair becomes one entry. The bottom block renders the live SKU preview
 * exactly the way the design source builds it.
 */
export function VariationsBuilder({ value, onChange, specCode, printCode }: Props) {
  const t = useTranslations("products");

  const toggleSize = (size: Size) => {
    const next = value.sizes.includes(size)
      ? value.sizes.filter((s) => s !== size)
      : [...value.sizes, size];
    onChange({ ...value, sizes: next });
  };

  const addColor = (preset?: { hex: string; name: string; code: string }) => {
    const colors = value.colors.slice();
    if (preset) {
      // Skip duplicates by code.
      if (colors.some((c) => c.color_code === preset.code)) return;
      colors.push({ name: preset.name, hex: preset.hex, color_code: preset.code });
    } else {
      colors.push({ name: "", hex: undefined, color_code: "" });
    }
    onChange({ ...value, colors });
  };

  const updateColor = (idx: number, patch: Partial<ColorRow>) => {
    const colors = value.colors.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...value, colors });
  };

  const removeColor = (idx: number) => {
    onChange({ ...value, colors: value.colors.filter((_, i) => i !== idx) });
  };

  const totalCells = value.sizes.length * value.colors.length;

  const skus = useMemo(() => {
    if (!specCode || value.sizes.length === 0 || value.colors.length === 0) return [];
    const result: string[] = [];
    for (const size of value.sizes) {
      for (const color of value.colors) {
        if (!color.color_code || color.color_code.length !== 3) continue;
        const base = `${specCode}-${size.toUpperCase()}-${color.color_code.toUpperCase()}`;
        result.push(printCode ? `${base}-${printCode}` : base);
      }
    }
    return result;
  }, [printCode, specCode, value.colors, value.sizes]);

  return (
    <div className="grid gap-[18px]" data-testid="variations-builder">
      <section>
        <h3 className="mb-2.5 border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
          {t("variations.sizesTitle")}
        </h3>
        <div className="flex flex-wrap gap-[6px]">
          {SIZES.map((size) => {
            const active = value.sizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                data-testid={`size-toggle-${size}`}
                aria-pressed={active}
                className="grid h-11 w-11 place-items-center rounded-[8px] border text-[13px] font-display"
                style={{
                  borderColor: active ? "var(--brand-catalog)" : "var(--orion-line)",
                  borderWidth: active ? 1.5 : 1,
                  background: active
                    ? "color-mix(in oklab, var(--brand-catalog) 8%, var(--orion-surface))"
                    : "var(--orion-surface)",
                  color: active ? "var(--orion-ink)" : "var(--orion-ink-3)",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {t(`variations.sizes.${size}`)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
            {t("variations.colorsTitle")}
          </h3>
          <span className="text-[11px] text-[color:var(--orion-ink-3)] tabular-nums">
            {value.colors.length}
          </span>
        </div>

        <div className="grid gap-2">
          {value.colors.map((c, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-2"
              data-testid={`color-row-${idx}`}
            >
              <input
                type="color"
                aria-label={t("variations.colorSwatch")}
                value={c.hex ?? "#1f1f1f"}
                onChange={(e) => updateColor(idx, { hex: e.target.value })}
                className="h-7 w-7 cursor-pointer rounded-full border-0 p-0"
              />
              <Input
                value={c.name}
                onChange={(e) => updateColor(idx, { name: e.target.value })}
                placeholder={t("variations.colorNamePlaceholder")}
                className="h-9 flex-1 rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] text-[13px]"
                data-testid={`color-name-${idx}`}
              />
              <Input
                value={c.color_code}
                onChange={(e) =>
                  updateColor(idx, {
                    color_code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3),
                  })
                }
                placeholder="COR"
                maxLength={3}
                className="h-9 w-[68px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] text-center font-mono text-[12px] uppercase"
                data-testid={`color-code-${idx}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("variations.removeColor")}
                onClick={() => removeColor(idx)}
                className="h-8 w-8 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)]"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addColor()}
            className="h-8 gap-1 rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-2.5 text-[12px] text-[color:var(--brand-catalog)]"
            data-testid="add-color-button"
          >
            <Plus className="size-3" /> {t("variations.addColor")}
          </Button>
          {DEFAULT_PALETTE.map((preset) => (
            <button
              key={preset.code}
              type="button"
              onClick={() => addColor(preset)}
              className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-2 text-[11.5px] text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]"
            >
              <span
                aria-hidden
                className="size-3 rounded-full border border-white shadow-[0_0_0_1px_var(--orion-line)]"
                style={{ background: preset.hex }}
              />
              {preset.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
            {t("variations.preview")}
          </h3>
          <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
            {totalCells} {t("variations.cells")}
          </span>
        </div>
        {skus.length === 0 ? (
          <div className="rounded-[8px] bg-[color:var(--orion-surface-2)] p-3 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("variations.noPreview")}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
            {skus.map((sku) => (
              <div
                key={sku}
                className="rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface-2)] px-2.5 py-1.5 font-mono text-[11.5px] text-[color:var(--orion-ink)]"
              >
                {sku}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function buildVariationItems(value: VariationsBuilderValue): VariationItem[] {
  const items: VariationItem[] = [];
  for (const size of value.sizes) {
    for (const color of value.colors) {
      if (!color.name || !color.color_code || color.color_code.length !== 3) continue;
      items.push({
        size,
        color: color.name,
        color_code: color.color_code.toUpperCase(),
      });
    }
  }
  return items;
}
