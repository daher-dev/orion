"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ReportDateRange } from "@/lib/schemas/reports";

type Preset = "last7d" | "last30d" | "last90d" | "custom";

type Props = {
  value: ReportDateRange;
  onChange: (range: ReportDateRange) => void;
};

/**
 * Convert a JS Date to a `YYYY-MM-DD` string in the local tz.
 *
 * The backend reads `date_from` / `date_to` as `datetime` query params; a
 * bare YYYY-MM-DD string is interpreted as the start of that day in UTC,
 * which is what consumers want for inclusive day-level windows.
 */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function rangeFromPreset(preset: Preset): ReportDateRange {
  if (preset === "custom") return {};
  const days = preset === "last7d" ? 7 : preset === "last30d" ? 30 : 90;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { date_from: toIsoDate(from), date_to: toIsoDate(to) };
}

/**
 * Date range selector — 3 presets (7d / 30d / 90d) + a custom mode.
 *
 * Renders as a single trigger button that opens a popover. Defaults to the
 * `last90d` preset, matching the design's "Últimos 90 dias" chip.
 */
export function DateRangePicker({ value, onChange }: Props) {
  const t = useTranslations("reports.dateRange");
  const [open, setOpen] = useState(false);

  // Infer the active preset from the current value so we can show the
  // active chip without forcing the parent to keep extra state.
  const activePreset = useMemo<Preset>(() => {
    for (const preset of ["last7d", "last30d", "last90d"] as const) {
      const r = rangeFromPreset(preset);
      if (r.date_from === value.date_from && r.date_to === value.date_to) {
        return preset;
      }
    }
    return value.date_from || value.date_to ? "custom" : "last90d";
  }, [value]);

  const [draftFrom, setDraftFrom] = useState<string>(value.date_from ?? "");
  const [draftTo, setDraftTo] = useState<string>(value.date_to ?? "");

  function handleOpenChange(next: boolean) {
    if (next) {
      // Re-seed the draft inputs each time the popover opens so they match
      // the canonical value. Doing this inline (instead of via useEffect)
      // avoids the cascading-render lint from the React Compiler ruleset.
      setDraftFrom(value.date_from ?? "");
      setDraftTo(value.date_to ?? "");
    }
    setOpen(next);
  }

  function pickPreset(preset: Preset) {
    const next = rangeFromPreset(preset);
    onChange(next);
    setOpen(false);
  }

  function applyCustom() {
    onChange({
      date_from: draftFrom || undefined,
      date_to: draftTo || undefined,
    });
    setOpen(false);
  }

  const label =
    activePreset === "last7d"
      ? t("last7d")
      : activePreset === "last30d"
        ? t("last30d")
        : activePreset === "last90d"
          ? t("last90d")
          : `${value.date_from ?? "—"} → ${value.date_to ?? "—"}`;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {/*
         * Date chip — `.btn` from /docs/design/source/styles.css:
         * inline-flex, 7px gap, 7/13 padding, 6px radius, 1px line border,
         * surface bg, ink color, 13px / 500.
         */}
        <button
          type="button"
          className="inline-flex h-auto items-center gap-[7px] whitespace-nowrap rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]"
        >
          <CalendarIcon size={14} strokeWidth={2.2} className="text-[color:var(--orion-ink-3)]" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[280px] rounded-[12px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-3"
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {(["last7d", "last30d", "last90d"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => pickPreset(preset)}
                data-active={activePreset === preset}
                className="rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2 py-1.5 text-[11.5px] font-medium text-[color:var(--orion-ink-2)] transition-colors hover:text-[color:var(--orion-ink)] data-[active=true]:border-[color:var(--brand-reports)] data-[active=true]:bg-[color:var(--orion-surface)] data-[active=true]:text-[color:var(--orion-ink)]"
              >
                {t(preset)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-date-from" className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("from")}
              </Label>
              <Input
                id="report-date-from"
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="h-8 rounded-[6px] text-[12.5px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="report-date-to" className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("to")}
              </Label>
              <Input
                id="report-date-to"
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                className="h-8 rounded-[6px] text-[12.5px]"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={applyCustom}
            className="h-8 rounded-[6px] bg-[color:var(--brand-reports)] text-[12.5px] font-medium text-white hover:bg-[color:var(--brand-reports)]/90"
          >
            {t("apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
