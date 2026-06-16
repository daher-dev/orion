"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  sizes: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/**
 * Tag-style editor for the size grid. New entries are uppercased + de-duped.
 * Port of `SizesEditor` from docs/design/pages/settings.jsx.
 */
export function SizesEditor({ sizes, onChange, disabled }: Props) {
  const t = useTranslations("catalogConfig.sizes");
  const [val, setVal] = useState("");

  const add = () => {
    const v = val.trim().toUpperCase();
    if (v && !sizes.includes(v)) onChange([...sizes, v]);
    setVal("");
  };
  const remove = (s: string) => onChange(sizes.filter((x) => x !== s));

  return (
    <div>
      <div className="flex flex-wrap gap-2" data-testid="sizes-list">
        {sizes.map((s) => (
          <span
            key={s}
            data-testid="sizes-chip"
            className="inline-flex items-center gap-1 rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] py-[5px] pl-3 pr-[5px] font-serif text-[14px] text-[color:var(--orion-ink)]"
          >
            {s}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={t("add")}
              disabled={disabled || sizes.length <= 1}
              onClick={() => remove(s)}
              className="size-5 text-[color:var(--orion-ink-3)]"
            >
              <X className="size-3" />
            </Button>
          </span>
        ))}
        {!sizes.length ? (
          <span className="text-[12.5px] text-[color:var(--orion-ink-3)]">{t("empty")}</span>
        ) : null}
      </div>
      <div className="mt-3 flex max-w-[280px] items-center gap-2">
        <Input
          value={val}
          disabled={disabled}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t("placeholder")}
          data-testid="sizes-input"
          className="h-[34px] flex-1 rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[11px] text-[13px] text-[color:var(--orion-ink)] shadow-none"
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={disabled}
          data-testid="sizes-add"
          className="h-[34px] gap-1.5"
        >
          <Plus className="size-3.5" /> {t("add")}
        </Button>
      </div>
    </div>
  );
}
