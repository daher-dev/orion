"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  printFormSchema,
  type Print,
  type PrintFormPayload,
  type PrintFormValues,
} from "@/lib/schemas/print";

type Props = {
  formId: string;
  initial?: Print;
  onSubmit: (values: PrintFormPayload) => void | Promise<void>;
};

const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-catalog)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-catalog)_16%,transparent)] focus-visible:outline-none";

export function PrintForm({ formId, initial, onSubmit }: Props) {
  const t = useTranslations("prints.form");
  const tValidation = useTranslations("prints.form.validation");

  const defaultValues: PrintFormValues = {
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    image_url: initial?.image_url ?? "",
    cost_per_unit: initial?.cost_per_unit ?? "0",
  };

  const form = useForm<PrintFormValues>({
    resolver: zodResolver(printFormSchema),
    defaultValues,
  });

  const handleSubmit = form.handleSubmit((values) => onSubmit(values as PrintFormPayload));

  function fieldError(key: keyof PrintFormValues): string | undefined {
    const err = form.formState.errors[key];
    if (!err?.message) return undefined;
    return tValidation(err.message as string);
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="grid gap-[18px]">
      <div className="grid gap-[16px] sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="print-code" className={FIELD_LABEL_CLASS}>
            {t("labels.code")}
          </label>
          <Input
            id="print-code"
            autoComplete="off"
            aria-invalid={!!form.formState.errors.code}
            className={FIELD_INPUT_CLASS}
            placeholder={t("placeholders.code")}
            {...form.register("code")}
          />
          {fieldError("code") ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {fieldError("code")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="print-name" className={FIELD_LABEL_CLASS}>
            {t("labels.name")}
          </label>
          <Input
            id="print-name"
            autoComplete="off"
            aria-invalid={!!form.formState.errors.name}
            className={FIELD_INPUT_CLASS}
            placeholder={t("placeholders.name")}
            {...form.register("name")}
          />
          {fieldError("name") ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {fieldError("name")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="print-image" className={FIELD_LABEL_CLASS}>
          {t("labels.imageUrl")}
        </label>
        <Input
          id="print-image"
          type="url"
          autoComplete="off"
          aria-invalid={!!form.formState.errors.image_url}
          className={FIELD_INPUT_CLASS}
          placeholder={t("placeholders.imageUrl")}
          {...form.register("image_url")}
        />
        <p className="text-[11px] italic text-[color:var(--orion-ink-3)]">
          {t("helpers.imageUrl")}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="print-cost" className={FIELD_LABEL_CLASS}>
          {t("labels.costPerUnit")}
        </label>
        <Controller
          control={form.control}
          name="cost_per_unit"
          render={({ field }) => (
            <NumberInput
              id="print-cost"
              tone="catalog"
              prefix="R$"
              step={0.1}
              decimals={2}
              min={0}
              align="right"
              placeholder={t("placeholders.costPerUnit")}
              aria-invalid={!!form.formState.errors.cost_per_unit}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
        {fieldError("cost_per_unit") ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {fieldError("cost_per_unit")}
          </p>
        ) : null}
      </div>
    </form>
  );
}
