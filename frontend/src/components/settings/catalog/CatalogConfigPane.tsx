"use client";

import { useMemo, useState } from "react";
import { Info, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanAccess } from "@/hooks/use-permissions";
import { useCatalogConfig, useUpdateCatalogConfig } from "@/hooks/use-catalog-config";
import {
  companySettingsConfigSchema,
  DEFAULT_CATALOG_CONFIG,
  type CompanySettingsConfig,
} from "@/lib/schemas/company-settings";
import { PaletteEditor } from "./PaletteEditor";
import { SizesEditor } from "./SizesEditor";
import { StringListEditor } from "./StringListEditor";
import { GarmentTypesEditor } from "./GarmentTypesEditor";

const CARD_CLASS =
  "overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]";

function SettingsCard({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className={CARD_CLASS}>
      <div className="border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {title}
        </div>
        <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">{sub}</div>
      </div>
      <div className="px-[18px] py-[16px]">{children}</div>
    </div>
  );
}

const clone = (c: CompanySettingsConfig): CompanySettingsConfig =>
  JSON.parse(JSON.stringify(c));

/**
 * Settings › Catalog. Edits the catalog half of the `company_settings` config
 * blob (palettes, sizes, fabric types, garment types, trims, techniques). The
 * `stockThresholds` portion is owned by the StockThresholdsPane; we preserve it
 * untouched on save so the full-replace PUT keeps both halves consistent.
 * Source: docs/design/pages/settings.jsx (CatalogPane).
 */
export function CatalogConfigPane() {
  const t = useTranslations("catalogConfig");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("companies.read");
  const canWrite = useCanAccess("companies.write");

  const { data, isPending, isError } = useCatalogConfig();
  const update = useUpdateCatalogConfig();

  // Local editable draft. We re-seed it during render (React's "adjust state
  // while rendering" pattern) whenever the server config identity changes, so
  // no effect / synchronous setState-in-effect is needed.
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
      !!draft && !!serverConfig && JSON.stringify(draft) !== JSON.stringify(serverConfig),
    [draft, serverConfig],
  );

  if (!canRead) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {tForbidden("catalog")}
      </div>
    );
  }

  if (isPending || !draft) {
    return (
      <div className="grid gap-[18px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${CARD_CLASS} p-5`}>
            <Skeleton className="mb-3 h-5 w-1/2" />
            <Skeleton className="h-9" />
          </div>
        ))}
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

  const patch = <K extends keyof CompanySettingsConfig>(
    key: K,
    val: CompanySettingsConfig[K],
  ) => setDraft((d) => (d ? { ...d, value: { ...d.value, [key]: val } } : d));

  const handleSave = async () => {
    const parsed = companySettingsConfigSchema.safeParse(draft);
    if (!parsed.success) {
      // Surface the first actionable validation issue (hex / required / sku).
      const issue = parsed.error.issues[0];
      const code = issue?.message;
      const known = ["validation.hex", "validation.required", "validation.skuPrefix"];
      const path0 = String(issue?.path[0] ?? "");
      let msg = t("saveError");
      if (code === "validation.hex") msg = t("validation.hex");
      else if (path0 === "garmentTypes") msg = t("validation.needSku");
      else if (known.includes(code ?? "")) msg = t("validation.required");
      toast.error(msg);
      return;
    }
    try {
      await update.mutateAsync({ config: parsed.data });
      toast.success(t("saved"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("saveError"), detail ? { description: detail } : undefined);
    }
  };

  const handleReset = () => {
    // Reset only the catalog half; keep the live thresholds.
    setDraft((d) =>
      d
        ? {
            ...d,
            value: {
              ...clone(DEFAULT_CATALOG_CONFIG),
              stockThresholds: d.value.stockThresholds,
            },
          }
        : d,
    );
  };

  return (
    <div className="grid gap-[18px]" data-testid="catalog-config-pane">
      <SettingsCard title={t("productColors.title")} sub={t("productColors.sub")}>
        <PaletteEditor
          colors={draft.productColors}
          onChange={(v) => patch("productColors", v)}
          addLabel={t("productColors.add")}
          namePlaceholder={t("colorNamePlaceholder")}
          removeLabel={t("remove")}
          disabled={!canWrite}
          testIdPrefix="product-colors"
        />
      </SettingsCard>

      <SettingsCard title={t("printColors.title")} sub={t("printColors.sub")}>
        <PaletteEditor
          colors={draft.printColors}
          onChange={(v) => patch("printColors", v)}
          addLabel={t("printColors.add")}
          namePlaceholder={t("colorNamePlaceholder")}
          removeLabel={t("remove")}
          disabled={!canWrite}
          testIdPrefix="print-colors"
        />
      </SettingsCard>

      <SettingsCard title={t("sizes.title")} sub={t("sizes.sub")}>
        <SizesEditor
          sizes={draft.sizes}
          onChange={(v) => patch("sizes", v)}
          disabled={!canWrite}
        />
      </SettingsCard>

      <SettingsCard title={t("fabricTypes.title")} sub={t("fabricTypes.sub")}>
        <StringListEditor
          items={draft.fabricTypes}
          onChange={(v) => patch("fabricTypes", v)}
          placeholder={t("fabricTypes.placeholder")}
          addLabel={t("fabricTypes.add")}
          removeLabel={t("remove")}
          disabled={!canWrite}
          testIdPrefix="fabric-types"
        />
      </SettingsCard>

      <SettingsCard title={t("garmentTypes.title")} sub={t("garmentTypes.sub")}>
        <GarmentTypesEditor
          types={draft.garmentTypes}
          onChange={(v) => patch("garmentTypes", v)}
          disabled={!canWrite}
        />
      </SettingsCard>

      <SettingsCard title={t("aviamentos.title")} sub={t("aviamentos.sub")}>
        <StringListEditor
          items={draft.aviamentos}
          onChange={(v) => patch("aviamentos", v)}
          placeholder={t("aviamentos.placeholder")}
          addLabel={t("aviamentos.add")}
          removeLabel={t("remove")}
          disabled={!canWrite}
          testIdPrefix="aviamentos"
        />
      </SettingsCard>

      <SettingsCard title={t("techniques.title")} sub={t("techniques.sub")}>
        <StringListEditor
          items={draft.techniques}
          onChange={(v) => patch("techniques", v)}
          placeholder={t("techniques.placeholder")}
          addLabel={t("techniques.add")}
          removeLabel={t("remove")}
          disabled={!canWrite}
          testIdPrefix="techniques"
        />
      </SettingsCard>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-[12px] text-[color:var(--orion-ink-3)]">
          <Info className="size-3" /> {t("footnote")}
        </div>
        {canWrite ? (
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={update.isPending}
              data-testid="catalog-config-reset"
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" /> {t("reset")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!dirty || update.isPending}
              data-testid="catalog-config-save"
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
