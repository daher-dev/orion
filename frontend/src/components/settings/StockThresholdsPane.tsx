"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  Boxes,
  Info,
  Layers,
  Palette,
  RotateCcw,
  Scroll,
  Shirt,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCanAccess } from "@/hooks/use-permissions";
import { useCatalogConfig, useUpdateCatalogConfig } from "@/hooks/use-catalog-config";
import {
  DEFAULT_CATALOG_CONFIG,
  STOCK_TIER_IDS,
  STOCK_TIER_UNITS,
  type CompanySettingsConfig,
  type StockThreshold,
  type StockThresholdUnit,
  type StockTierId,
} from "@/lib/schemas/company-settings";

const CARD_CLASS =
  "overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]";

const TIER_ICON: Record<StockTierId, LucideIcon> = {
  fabric: Layers,
  paper: Scroll,
  blank: Shirt,
  printed: Palette,
  product: Boxes,
};

const clone = (c: CompanySettingsConfig): CompanySettingsConfig =>
  JSON.parse(JSON.stringify(c));

/**
 * Settings › Stock alerts. Five-tier low-stock threshold editor backed by the
 * `stockThresholds` half of the `company_settings` config blob. Each tier has
 * an enabled toggle, a unit (pct|qty|kg|m, constrained per tier) and a value.
 * Preserves the catalog half on save. Source: docs/design/pages/settings.jsx
 * (StockThresholdsPane).
 */
export function StockThresholdsPane() {
  const t = useTranslations("thresholds");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("companies.read");
  const canWrite = useCanAccess("companies.write");

  const { data, isPending, isError } = useCatalogConfig();
  const update = useUpdateCatalogConfig();

  // Local editable draft, re-seeded during render when the server config
  // identity changes (React's "adjust state while rendering" pattern — avoids a
  // synchronous setState inside an effect).
  const serverConfig = data?.config ?? null;
  const [draftState, setDraft] = useState<{
    source: CompanySettingsConfig;
    value: CompanySettingsConfig;
  } | null>(null);

  let draft: CompanySettingsConfig | null = draftState?.value ?? null;
  if (serverConfig && draftState?.source !== serverConfig) {
    draft = clone(serverConfig);
    setDraft({ source: serverConfig, value: draft });
  }

  const dirty = useMemo(
    () =>
      !!draft &&
      !!serverConfig &&
      JSON.stringify(draft.stockThresholds) !== JSON.stringify(serverConfig.stockThresholds),
    [draft, serverConfig],
  );

  if (!canRead) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {tForbidden("stockAlerts")}
      </div>
    );
  }

  if (isPending || !draft) {
    return (
      <div className={`${CARD_CLASS} p-5`}>
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {t("loadError")}
      </div>
    );
  }

  const setTier = (id: StockTierId, patch: Partial<StockThreshold>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            value: {
              ...d.value,
              stockThresholds: {
                ...d.value.stockThresholds,
                [id]: { ...d.value.stockThresholds[id], ...patch },
              },
            },
          }
        : d,
    );

  const handleSave = async () => {
    try {
      await update.mutateAsync({ config: draft });
      toast.success(t("saved"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("saveError"), detail ? { description: detail } : undefined);
    }
  };

  const handleReset = () =>
    setDraft((d) =>
      d
        ? {
            ...d,
            value: {
              ...d.value,
              stockThresholds: clone(DEFAULT_CATALOG_CONFIG).stockThresholds,
            },
          }
        : d,
    );

  const summaryFor = (id: StockTierId, cur: StockThreshold): string => {
    const scope = t(`tiers.${id}.scope`);
    if (!cur.enabled) return t("summary.off");
    if (cur.unit === "pct") return t("summary.pct", { value: cur.value, scope });
    return t("summary.abs", { value: cur.value, unit: t(`units.${cur.unit}`), scope });
  };

  return (
    <div className="grid gap-[18px]" data-testid="stock-thresholds-pane">
      <div className={CARD_CLASS}>
        <div className="border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">{t("sub")}</div>
        </div>

        <div>
          {STOCK_TIER_IDS.map((id, i) => {
            const cur = draft.stockThresholds[id];
            const Icon = TIER_ICON[id];
            const { units } = STOCK_TIER_UNITS[id];
            const on = cur.enabled;
            const defaults = STOCK_TIER_UNITS[id].defaults;
            return (
              <div
                key={id}
                data-testid={`threshold-tier-${id}`}
                className={cn(
                  "px-[18px] py-[15px] transition-opacity",
                  i ? "border-t border-[color:var(--orion-line-soft)]" : "",
                  on ? "opacity-100" : "opacity-[0.78]",
                )}
              >
                <div className="flex flex-wrap items-center gap-3.5">
                  <span
                    className={cn(
                      "grid size-[38px] shrink-0 place-items-center rounded-[9px] transition-colors",
                      on
                        ? "bg-[color:color-mix(in_oklab,var(--brand-inv)_12%,var(--orion-surface))] text-[color:var(--brand-inv)]"
                        : "bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-3)]",
                    )}
                  >
                    <Icon className="size-[18px]" strokeWidth={1.7} />
                  </span>
                  <div className="flex min-w-[160px] flex-1 flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-[color:var(--orion-ink)]">
                      {t(`tiers.${id}.label`)}
                    </span>
                    <span className="font-mono text-[10.5px] text-[color:var(--orion-ink-3)]">
                      {t(`tiers.${id}.where`)}
                    </span>
                  </div>

                  <div className="ml-auto flex items-center gap-3">
                    {on ? (
                      <div className="flex items-center gap-2">
                        {units.length > 1 ? (
                          <div
                            className="inline-flex overflow-hidden rounded-[7px] border border-[color:var(--orion-line)]"
                            role="group"
                          >
                            {units.map((u: StockThresholdUnit) => (
                              <button
                                key={u}
                                type="button"
                                disabled={!canWrite}
                                onClick={() =>
                                  setTier(id, { unit: u, value: defaults[u] ?? 0 })
                                }
                                data-testid={`threshold-unit-${id}-${u}`}
                                aria-pressed={cur.unit === u}
                                className={cn(
                                  "px-2.5 py-1 text-[12px] font-medium",
                                  cur.unit === u
                                    ? "bg-[color:var(--brand-inv)] text-white"
                                    : "bg-[color:var(--orion-surface)] text-[color:var(--orion-ink-2)]",
                                )}
                              >
                                {t(`units.${u}`)}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <div className="w-[118px]">
                          <NumberInput
                            value={cur.value}
                            disabled={!canWrite}
                            tone="inv"
                            onChange={(next) =>
                              setTier(id, { value: next === "" ? 0 : Number(next) })
                            }
                            step={cur.unit === "pct" ? 5 : 1}
                            min={0}
                            max={cur.unit === "pct" ? 100 : undefined}
                            decimals={0}
                            align="right"
                            suffix={t(`units.${cur.unit}`)}
                            data-testid={`threshold-value-${id}`}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="rounded-full bg-[color:var(--orion-surface-2)] px-2.5 py-1 text-[11px] text-[color:var(--orion-ink-3)]">
                        {t("noAlert")}
                      </span>
                    )}
                    <Switch
                      checked={on}
                      disabled={!canWrite}
                      onCheckedChange={(v) => setTier(id, { enabled: v })}
                      aria-label={on ? t("enabledOn") : t("enabledOff")}
                      data-testid={`threshold-toggle-${id}`}
                    />
                  </div>
                </div>

                <div
                  className={cn(
                    "ml-[52px] mt-[9px] flex items-center gap-1.5 text-[12px]",
                    on ? "text-[color:var(--orion-ink-2)]" : "text-[color:var(--orion-ink-3)]",
                  )}
                >
                  {on ? (
                    <Bell className="size-3 shrink-0 text-[color:var(--brand-inv)]" />
                  ) : (
                    <BellOff className="size-3 shrink-0 text-[color:var(--orion-ink-3)]" />
                  )}
                  {summaryFor(id, cur)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex max-w-[62ch] items-center gap-2 text-[12px] text-[color:var(--orion-ink-3)]">
          <Info className="size-3 shrink-0" /> {t("footnote")}
        </div>
        {canWrite ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={update.isPending}
              data-testid="thresholds-reset"
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" /> {t("reset")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!dirty || update.isPending}
              data-testid="thresholds-save"
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-settings)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{ borderColor: "color-mix(in oklab, var(--brand-settings) 70%, black)" }}
            >
              {t("save")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
