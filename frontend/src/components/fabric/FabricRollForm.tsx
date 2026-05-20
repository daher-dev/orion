"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Rows3, Shirt } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FABRIC_TYPES,
  FABRIC_ROLL_KINDS,
  fabricRollFormSchema,
  type FabricRollFormPayload,
  type FabricRollFormValues,
} from "@/lib/schemas/fabric";

/**
 * Preset color palette — direct port of `COLOR_NAMES_INV` from
 * /docs/design/source/pages/inventory.jsx. Clicking a swatch fills the
 * free-text color input; users can still type any custom color name.
 */
const COLOR_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Preto", hex: "#1f1f1f" },
  { name: "Marrom", hex: "#7a4b2a" },
  { name: "Areia", hex: "#c9b9a3" },
  { name: "Off-white", hex: "#efe6d3" },
  { name: "Bege", hex: "#cfb98e" },
  { name: "Verde-musgo", hex: "#7a8a76" },
  { name: "Verde", hex: "#3a4a3d" },
  { name: "Caramelo", hex: "#6b4a2e" },
  { name: "Branco", hex: "#f4f1ea" },
  { name: "Vermelho", hex: "#b03a2e" },
];

type Props = {
  formId: string;
  defaultValues?: Partial<FabricRollFormValues>;
  serverError?: string | null;
  onSubmit: (values: FabricRollFormPayload) => void;
};

const SECTION_HEADING_CLASS =
  "mt-[18px] mb-[10px] flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-inv)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-inv)_16%,transparent)] focus-visible:outline-none";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FabricRollForm({ formId, defaultValues, serverError, onSubmit }: Props) {
  const t = useTranslations("fabric.form");
  const tKinds = useTranslations("fabric.fabricRollKinds");
  const tTypes = useTranslations("fabric.fabricTypes");

  const form = useForm<FabricRollFormValues, unknown, FabricRollFormPayload>({
    resolver: zodResolver(fabricRollFormSchema),
    defaultValues: {
      received_at: defaultValues?.received_at ?? todayIso(),
      supplier_name: defaultValues?.supplier_name ?? "",
      kind: defaultValues?.kind ?? "body",
      fabric_type: defaultValues?.fabric_type ?? "jersey",
      color: defaultValues?.color ?? "",
      initial_weight_kg: defaultValues?.initial_weight_kg ?? "",
      current_weight_kg: defaultValues?.current_weight_kg ?? "",
      price_per_kg: defaultValues?.price_per_kg ?? "",
    },
  });

  const errors = form.formState.errors;
  const kind = form.watch("kind");

  function translateError(key: string | undefined): string | undefined {
    if (!key) return undefined;
    return t(`validation.${key.replace("validation.", "")}` as never);
  }

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col"
    >
      <div className={SECTION_HEADING_CLASS} style={{ marginTop: 0 }}>
        {t("sections.identity")}
      </div>

      <div className="mb-[14px] grid grid-cols-2 gap-2">
        {FABRIC_ROLL_KINDS.map((k) => {
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              data-testid={`fabric-kind-${k}`}
              onClick={() =>
                form.setValue("kind", k, { shouldDirty: true, shouldValidate: true })
              }
              style={{
                border: active ? "1.5px solid var(--brand-inv)" : "1px solid var(--orion-line)",
                background: active
                  ? "color-mix(in oklab, var(--brand-inv) 10%, var(--orion-surface))"
                  : "var(--orion-surface)",
                color: active ? "var(--orion-ink)" : "var(--orion-ink-2)",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
              }}
            >
              {k === "rib" ? (
                <Rows3 size={14} strokeWidth={1.6} />
              ) : (
                <Shirt size={14} strokeWidth={1.6} />
              )}
              {tKinds(k)}
            </button>
          );
        })}
      </div>

      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-fabric_type`} className={FIELD_LABEL_CLASS}>
          {t("labels.fabricType")}
        </label>
        <Controller
          control={form.control}
          name="fabric_type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={`${formId}-fabric_type`}
                data-testid="fabric-fabric-type-trigger"
                className={FIELD_INPUT_CLASS}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FABRIC_TYPES.map((ft) => (
                  <SelectItem key={ft} value={ft}>
                    {tTypes(ft)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className={SECTION_HEADING_CLASS}>{t("sections.fabric")}</div>
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-supplier_name`} className={FIELD_LABEL_CLASS}>
            {t("labels.supplier")}
          </label>
          <Input
            id={`${formId}-supplier_name`}
            autoComplete="off"
            placeholder={t("placeholders.supplier")}
            className={FIELD_INPUT_CLASS}
            aria-invalid={!!errors.supplier_name}
            {...form.register("supplier_name")}
          />
          {errors.supplier_name?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.supplier_name.message as string)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-color`} className={FIELD_LABEL_CLASS}>
            {t("labels.color")}
          </label>
          <Input
            id={`${formId}-color`}
            autoComplete="off"
            placeholder={t("placeholders.color")}
            className={FIELD_INPUT_CLASS}
            aria-invalid={!!errors.color}
            {...form.register("color")}
          />
          {/* Preset color swatches — clicking fills the input. Matches the
              pill-style color chooser from inventory.jsx NewFabricSheet. */}
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((c) => {
                  const active =
                    field.value?.trim().toLowerCase() === c.name.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      type="button"
                      data-testid={`fabric-color-preset-${c.name}`}
                      onClick={() =>
                        field.onChange(active ? "" : c.name)
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full font-[inherit]"
                      style={{
                        padding: "5px 10px 5px 6px",
                        border: active
                          ? "1.5px solid var(--brand-inv)"
                          : "1px solid var(--orion-line)",
                        background: active
                          ? "color-mix(in oklab, var(--brand-inv) 10%, var(--orion-surface))"
                          : "var(--orion-surface)",
                        fontSize: 12,
                        color: "var(--orion-ink-2)",
                      }}
                    >
                      <span
                        aria-hidden
                        className="size-3.5 flex-shrink-0 rounded-full"
                        style={{
                          background: c.hex,
                          boxShadow:
                            "0 0 0 1px var(--orion-line), inset 0 0 0 1px rgba(255,255,255,.15)",
                        }}
                      />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.color?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.color.message as string)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`${formId}-received_at`} className={FIELD_LABEL_CLASS}>
            {t("labels.receivedAt")}
          </label>
          <Input
            id={`${formId}-received_at`}
            type="date"
            className={FIELD_INPUT_CLASS}
            aria-invalid={!!errors.received_at}
            {...form.register("received_at")}
          />
          {errors.received_at?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.received_at.message as string)}
            </p>
          ) : null}
        </div>
      </div>

      <div className={SECTION_HEADING_CLASS}>{t("sections.weight")}</div>
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-initial_weight_kg`} className={FIELD_LABEL_CLASS}>
            {t("labels.initialWeight")}
          </label>
          <Input
            id={`${formId}-initial_weight_kg`}
            inputMode="decimal"
            placeholder={t("placeholders.weight")}
            className={FIELD_INPUT_CLASS}
            aria-invalid={!!errors.initial_weight_kg}
            {...form.register("initial_weight_kg")}
          />
          {errors.initial_weight_kg?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.initial_weight_kg.message as string)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-current_weight_kg`} className={FIELD_LABEL_CLASS}>
            {t("labels.currentWeight")}
          </label>
          <Input
            id={`${formId}-current_weight_kg`}
            inputMode="decimal"
            placeholder={t("placeholders.weight")}
            className={FIELD_INPUT_CLASS}
            aria-invalid={!!errors.current_weight_kg || !!serverError}
            {...form.register("current_weight_kg")}
          />
          {errors.current_weight_kg?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.current_weight_kg.message as string)}
            </p>
          ) : null}
          {serverError && !errors.current_weight_kg ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {serverError}
            </p>
          ) : null}
        </div>
      </div>

      <div className={SECTION_HEADING_CLASS}>{t("sections.pricing")}</div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${formId}-price_per_kg`} className={FIELD_LABEL_CLASS}>
          {t("labels.pricePerKg")}
        </label>
        <Input
          id={`${formId}-price_per_kg`}
          inputMode="decimal"
          placeholder={t("placeholders.price")}
          className={FIELD_INPUT_CLASS}
          aria-invalid={!!errors.price_per_kg}
          {...form.register("price_per_kg")}
        />
        {errors.price_per_kg?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.price_per_kg.message as string)}
          </p>
        ) : null}
      </div>
    </form>
  );
}
