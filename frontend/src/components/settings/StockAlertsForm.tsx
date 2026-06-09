"use client";

import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStockSettings, useUpdateStockSettings } from "@/hooks/use-stock-settings";
import { useCanAccess } from "@/hooks/use-permissions";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  MAX_LOW_STOCK_THRESHOLD,
} from "@/lib/schemas/stock-settings";

type FormValues = {
  low_stock_threshold: number;
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-settings)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-settings)_16%,transparent)] focus-visible:outline-none";
const CARD_CLASS =
  "overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]";
const CARD_HEAD_CLASS =
  "flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]";

export function StockAlertsForm() {
  const t = useTranslations("settings.stockAlerts");
  const tForbidden = useTranslations("settings.forbidden");
  const canRead = useCanAccess("stock.read");
  const canWrite = useCanAccess("stock.write");

  const { data, isPending, isError, error } = useStockSettings();
  const updateSettings = useUpdateStockSettings();

  const form = useForm<FormValues>({
    values: data ? { low_stock_threshold: data.low_stock_threshold } : undefined,
    defaultValues: { low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD },
  });

  if (!canRead) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {tForbidden("stockAlerts")}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className={`${CARD_CLASS} p-5`}>
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9 w-1/3" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${CARD_CLASS} px-6 py-10 text-center text-[color:var(--orion-ink-3)]`}>
        {error?.detail ?? "Error"}
      </div>
    );
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    const raw = Number(values.low_stock_threshold);
    if (!Number.isInteger(raw) || raw < 0 || raw > MAX_LOW_STOCK_THRESHOLD) {
      form.setError("low_stock_threshold", { message: t("validation.invalid") });
      return;
    }
    if (raw === data.low_stock_threshold) {
      toast.success(t("savedToast"));
      return;
    }
    try {
      await updateSettings.mutateAsync({ low_stock_threshold: raw });
      toast.success(t("savedToast"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("errorToast"), detail ? { description: detail } : undefined);
    }
  });

  return (
    <div className="grid gap-[18px]">
      <div className={CARD_CLASS}>
        <div className={CARD_HEAD_CLASS}>
          <div>
            <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("title")}
            </div>
            <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
              {t("sub")}
            </div>
          </div>
        </div>

        <form
          data-testid="stock-alerts-form"
          onSubmit={handleSubmit}
          noValidate
          className="grid gap-[18px] px-[18px] pt-[14px] pb-[18px]"
        >
          <div className="flex max-w-[260px] flex-col gap-1.5">
            <label htmlFor="low-stock-threshold" className={FIELD_LABEL_CLASS}>
              {t("labels.threshold")}
            </label>
            <Input
              id="low-stock-threshold"
              type="number"
              min={0}
              max={MAX_LOW_STOCK_THRESHOLD}
              step={1}
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={!!form.formState.errors.low_stock_threshold}
              disabled={!canWrite}
              className={FIELD_INPUT_CLASS}
              {...form.register("low_stock_threshold", { valueAsNumber: true })}
            />
            <p className="text-[11px] text-[color:var(--orion-ink-3)]">
              {t("helpers.threshold")}
            </p>
            {form.formState.errors.low_stock_threshold?.message ? (
              <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
                {form.formState.errors.low_stock_threshold.message}
              </p>
            ) : null}
          </div>

          {canWrite ? (
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateSettings.isPending}
                className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-settings)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
                style={{
                  borderColor: "color-mix(in oklab, var(--brand-settings) 70%, black)",
                }}
              >
                {t("save")}
              </Button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
