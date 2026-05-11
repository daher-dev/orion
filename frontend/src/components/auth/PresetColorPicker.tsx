"use client";

import { useTranslations } from "next-intl";
import { colorPresets } from "@/lib/schemas/company";

export type PresetColorPickerProps = {
  /** Currently-selected hex value (lowercased). */
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  /** Visible label rendered above the swatches. Pass `null` to hide it. */
  label?: string | null;
  /** ID used on the visible label so it gets associated to the swatch row. */
  labelId?: string;
};

/**
 * Six-swatch color preset row — direct visual port of the swatch picker in
 * `settings/CompanyForm.tsx`. Kept as its own component because both the
 * onboarding wizard (this feature) and any future "create company" flows
 * will share the exact same UI.
 *
 * Why we don't import `CompanyForm`'s inline implementation: the form there
 * is coupled to TanStack mutations + RHF state. The picker is pure UI and we
 * want it reusable from a `react-hook-form` `Controller` or a plain `useState`
 * shell without forcing a server round-trip.
 */
export function PresetColorPicker({
  value,
  onChange,
  disabled,
  label,
  labelId,
}: PresetColorPickerProps) {
  const tPresets = useTranslations("settings.colorPresets");
  const normalized = value.toLowerCase();

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <span
          id={labelId}
          className="text-[11.5px] font-semibold tracking-[0.08em] uppercase text-[color:var(--orion-ink-3)]"
        >
          {label}
        </span>
      ) : null}
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2"
      >
        {colorPresets.map((preset) => {
          const active = normalized === preset.hex.toLowerCase();
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={tPresets(preset.id)}
              data-color={preset.id}
              data-active={active || undefined}
              disabled={disabled}
              onClick={() => onChange(preset.hex)}
              className="size-9 rounded-lg border-0 transition-shadow data-[active]:shadow-[0_0_0_2px_var(--orion-surface),0_0_0_4px_currentColor] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: preset.hex, color: preset.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
