"use client";

import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCatalogConfig, useUpdateCatalogConfig } from "@/hooks/use-catalog-config";
import { deriveColorCode } from "@/lib/color-code";
import type { ColorEntry } from "@/lib/schemas/company-settings";
import type { ColorRow } from "./VariationsBuilder";

type Props = {
  value: ColorRow[];
  onChange: (next: ColorRow[]) => void;
  disabled?: boolean;
};

const CODE_RE = /^[A-Z]{3}$/;

/**
 * Palette-driven color selector. The company fabric palette
 * (`config.productColors`) is the source of truth; colors are picked from it as
 * chips. A brand-new color can be registered inline ("Nova cor") — it writes
 * through to the palette so it becomes selectable everywhere and shows up in
 * Settings, without forcing a detour there. Reusable in any color-picking form.
 */
export function PaletteColorPicker({ value, onChange, disabled }: Props) {
  const t = useTranslations("products.variations");
  const { data: catalog } = useCatalogConfig();
  const update = useUpdateCatalogConfig();

  const palette = useMemo<ColorEntry[]>(
    () => (catalog?.config.productColors ?? []).filter((c) => c.code),
    [catalog],
  );
  const selectedCodes = useMemo(() => new Set(value.map((c) => c.color_code)), [value]);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#1f1f1f");
  const [newCode, setNewCode] = useState("");
  const [codeEdited, setCodeEdited] = useState(false);

  const takenCodes = useMemo(() => palette.map((c) => c.code as string), [palette]);

  const toggle = (entry: ColorEntry) => {
    if (disabled) return;
    if (selectedCodes.has(entry.code as string)) {
      onChange(value.filter((c) => c.color_code !== entry.code));
    } else {
      onChange([...value, { name: entry.name, hex: entry.hex, color_code: entry.code as string }]);
    }
  };

  const onNameChange = (name: string) => {
    setNewName(name);
    if (!codeEdited) setNewCode(deriveColorCode(name, takenCodes));
  };

  const resetAdd = () => {
    setAdding(false);
    setNewName("");
    setNewHex("#1f1f1f");
    setNewCode("");
    setCodeEdited(false);
  };

  const codeTaken = takenCodes.includes(newCode);
  const canConfirm =
    !!catalog &&
    !!newName.trim() &&
    CODE_RE.test(newCode) &&
    !codeTaken &&
    !update.isPending;

  const confirmAdd = async () => {
    if (!catalog || !canConfirm) return;
    const entry: ColorEntry = { hex: newHex, name: newName.trim(), code: newCode };
    const nextConfig = {
      ...catalog.config,
      productColors: [...catalog.config.productColors, entry],
    };
    try {
      await update.mutateAsync({ config: nextConfig });
      onChange([...value, { name: entry.name, hex: entry.hex, color_code: entry.code as string }]);
      resetAdd();
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("addColorError"), detail ? { description: detail } : undefined);
    }
  };

  return (
    <div className="grid gap-2.5" data-testid="palette-color-picker">
      {/* Palette chips — click to (de)select. */}
      <div className="flex flex-wrap gap-1.5">
        {palette.map((entry) => {
          const active = selectedCodes.has(entry.code as string);
          return (
            <button
              key={entry.code}
              type="button"
              disabled={disabled}
              onClick={() => toggle(entry)}
              aria-pressed={active}
              data-testid={`palette-chip-${entry.code}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border px-2 text-[11.5px]"
              style={{
                borderColor: active ? "var(--brand-catalog)" : "var(--orion-line)",
                background: active
                  ? "color-mix(in oklab, var(--brand-catalog) 12%, var(--orion-surface))"
                  : "var(--orion-surface)",
                color: active ? "var(--orion-ink)" : "var(--orion-ink-2)",
                cursor: disabled ? "default" : "pointer",
              }}
            >
              <span
                aria-hidden
                className="size-3 rounded-full border border-white shadow-[0_0_0_1px_var(--orion-line)]"
                style={{ background: entry.hex }}
              />
              {entry.name}
              <span className="font-mono text-[10px] text-[color:var(--orion-ink-3)]">
                {entry.code}
              </span>
              {active ? <Check className="size-3 text-[color:var(--brand-catalog)]" /> : null}
            </button>
          );
        })}
      </div>

      {/* Inline "new color" — registers into the palette. */}
      {adding ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-2">
          <input
            type="color"
            aria-label={t("colorSwatch")}
            value={newHex}
            onChange={(e) => setNewHex(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded-full border-0 p-0"
          />
          <Input
            value={newName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("colorNamePlaceholder")}
            autoFocus
            data-testid="new-color-name"
            className="h-9 min-w-[140px] flex-1 rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] text-[13px]"
          />
          <Input
            value={newCode}
            onChange={(e) => {
              setCodeEdited(true);
              setNewCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3));
            }}
            placeholder="COR"
            maxLength={3}
            data-testid="new-color-code"
            className="h-9 w-[68px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] text-center font-mono text-[12px] uppercase"
          />
          <Button
            type="button"
            size="sm"
            onClick={confirmAdd}
            disabled={!canConfirm}
            data-testid="new-color-confirm"
            className="h-9"
          >
            {update.isPending ? t("addColorSaving") : t("addColorConfirm")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("removeColor")}
            onClick={resetAdd}
            className="h-8 w-8"
          >
            <X className="size-3.5" />
          </Button>
          {codeTaken ? (
            <p className="w-full text-[11px] text-[color:var(--status-err)]">{t("addColorCodeTaken")}</p>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setAdding(true)}
          data-testid="add-color-button"
          className="h-8 w-fit gap-1 rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-2.5 text-[12px] text-[color:var(--brand-catalog)]"
        >
          <Plus className="size-3" /> {t("addColor")}
        </Button>
      )}
    </div>
  );
}
