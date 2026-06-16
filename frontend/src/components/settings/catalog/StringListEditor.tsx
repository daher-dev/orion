"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  disabled?: boolean;
  testIdPrefix: string;
};

/**
 * Generic numbered list-of-strings editor (fabric types, trims, techniques).
 * Port of `StringListEditor` from docs/design/pages/settings.jsx.
 */
export function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
  disabled,
  testIdPrefix,
}: Props) {
  const update = (i: number, val: string) =>
    onChange(items.map((x, j) => (j === i ? val : x)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, ""]);

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(248px,1fr))] gap-2">
        {items.map((it, i) => (
          <div
            key={i}
            data-testid={`${testIdPrefix}-row`}
            className="flex items-center gap-1.5 rounded-[9px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] py-1 pl-1.5 pr-1"
          >
            <span className="w-[22px] shrink-0 text-center font-mono text-[10.5px] text-[color:var(--orion-ink-3)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <Input
              value={it}
              placeholder={placeholder}
              disabled={disabled}
              onChange={(e) => update(i, e.target.value)}
              data-testid={`${testIdPrefix}-input-${i}`}
              className="h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-1.5 text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={removeLabel}
              disabled={disabled || items.length <= 1}
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
