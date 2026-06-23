"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deriveColorCode } from "@/lib/color-code";
import type { ColorEntry } from "@/lib/schemas/company-settings";

type Props = {
  colors: ColorEntry[];
  onChange: (next: ColorEntry[]) => void;
  addLabel: string;
  namePlaceholder: string;
  removeLabel: string;
  disabled?: boolean;
  /** Stable prefix for data-testid hooks, e.g. "product-colors". */
  testIdPrefix: string;
  /**
   * When true, render an editable 3-letter SKU code per row (the fabric palette
   * is the source of truth for variation codes). A code is auto-derived from the
   * name until the user edits it. Print colors leave this off.
   */
  withCode?: boolean;
  codePlaceholder?: string;
};

/**
 * Grid of `{ hex, name }` swatches with a native color picker, free-text name,
 * mono hex readout, and per-row remove. Port of `PaletteEditor` from
 * docs/design/pages/settings.jsx. At least one color must remain.
 */
export function PaletteEditor({
  colors,
  onChange,
  addLabel,
  namePlaceholder,
  removeLabel,
  disabled,
  testIdPrefix,
  withCode,
  codePlaceholder = "COR",
}: Props) {
  const normalizeCode = (raw: string) =>
    raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

  const update = (i: number, patch: Partial<ColorEntry>) =>
    onChange(
      colors.map((c, j) => {
        if (j !== i) return c;
        const next = { ...c, ...patch };
        if (patch.code !== undefined) next.code = normalizeCode(patch.code);
        // Auto-derive a code from the name while the code is still blank.
        if (withCode && patch.name !== undefined && !c.code) {
          const taken = colors.flatMap((x, k) => (k === i ? [] : x.code ? [x.code] : []));
          next.code = deriveColorCode(patch.name, taken);
        }
        return next;
      }),
    );
  const remove = (i: number) => onChange(colors.filter((_, j) => j !== i));
  const add = () =>
    onChange([...colors, withCode ? { hex: "#cccccc", name: "", code: "" } : { hex: "#cccccc", name: "" }]);

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-2.5">
        {colors.map((c, i) => (
          <div
            key={i}
            data-testid={`${testIdPrefix}-row`}
            className="flex items-center gap-2 rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] py-2 pl-2.5 pr-2"
          >
            <label
              className="relative size-[30px] shrink-0 cursor-pointer rounded-[8px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]"
              style={{ background: c.hex }}
              title={namePlaceholder}
            >
              <input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(c.hex) ? c.hex : "#cccccc"}
                disabled={disabled}
                onChange={(e) => update(i, { hex: e.target.value })}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                aria-label={`${namePlaceholder} ${i + 1}`}
                data-testid={`${testIdPrefix}-hex-${i}`}
              />
            </label>
            <Input
              value={c.name}
              placeholder={namePlaceholder}
              disabled={disabled}
              onChange={(e) => update(i, { name: e.target.value })}
              data-testid={`${testIdPrefix}-name-${i}`}
              className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:ring-0"
            />
            {withCode ? (
              <Input
                value={c.code ?? ""}
                placeholder={codePlaceholder}
                maxLength={3}
                disabled={disabled}
                onChange={(e) => update(i, { code: e.target.value })}
                data-testid={`${testIdPrefix}-code-${i}`}
                className="h-7 w-[58px] shrink-0 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-1 text-center font-mono text-[11px] uppercase"
              />
            ) : (
              <span className="shrink-0 font-mono text-[10.5px] text-[color:var(--orion-ink-3)]">
                {c.hex}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={removeLabel}
              disabled={disabled || colors.length <= 1}
              onClick={() => remove(i)}
              data-testid={`${testIdPrefix}-remove-${i}`}
              className="size-7 shrink-0 text-[color:var(--orion-ink-3)]"
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
        data-testid={`${testIdPrefix}-add`}
        className="mt-3 gap-1.5"
      >
        <Plus className="size-3.5" /> {addLabel}
      </Button>
    </div>
  );
}
