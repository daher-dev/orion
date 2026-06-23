"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { SIZES, type Size, type VariationItem } from "@/lib/schemas/product";
import { PaletteColorPicker } from "./PaletteColorPicker";

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

/**
 * Interactive variation matrix builder.
 *
 *   rows = sizes (P/M/G/GG toggle buttons)
 *   cols = colors (picked from the company palette via PaletteColorPicker)
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
                className="grid h-11 w-11 place-items-center rounded-[8px] border font-serif text-[13px]"
                style={{
                  borderColor: active ? "var(--brand-catalog)" : "var(--orion-line)",
                  borderWidth: active ? 1.5 : 1,
                  background: active
                    ? "color-mix(in oklab, var(--brand-catalog) 14%, var(--orion-surface))"
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

        <PaletteColorPicker
          value={value.colors}
          onChange={(colors) => onChange({ ...value, colors })}
        />
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
