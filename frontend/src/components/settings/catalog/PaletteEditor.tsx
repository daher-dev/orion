"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}: Props) {
  const update = (i: number, patch: Partial<ColorEntry>) =>
    onChange(colors.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(colors.filter((_, j) => j !== i));
  const add = () => onChange([...colors, { hex: "#cccccc", name: "" }]);

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
            <span className="shrink-0 font-mono text-[10.5px] text-[color:var(--orion-ink-3)]">
              {c.hex}
            </span>
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
