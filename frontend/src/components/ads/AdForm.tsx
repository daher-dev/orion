"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/use-products";
import {
  ECOMMERCE_CHANNELS,
  adFormSchema,
  type Ad,
  type AdFormPayload,
  type AdFormValues,
  type Ecommerce,
} from "@/lib/schemas/ad";
import { CHANNEL_THEME } from "./AdsGrid";
import { cn } from "@/lib/utils";

type Props = {
  formId: string;
  initial?: Ad;
  onSubmit: (values: AdFormPayload) => void;
};

const SECTION_HEADING_CLASS =
  "mt-[18px] mb-[10px] flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-sales)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-sales)_16%,transparent)] focus-visible:outline-none";

export function AdForm({ formId, initial, onSubmit }: Props) {
  const t = useTranslations("ads.form");
  const tChannels = useTranslations("ads.channels");
  const products = useProducts({ page_size: 100 });
  const [productOpen, setProductOpen] = useState(false);

  const form = useForm<AdFormValues, unknown, AdFormPayload>({
    resolver: zodResolver(adFormSchema),
    defaultValues: {
      title: initial?.title ?? "",
      ecommerce: initial?.ecommerce ?? "shopee",
      external_id: initial?.external_id ?? "",
      product_id: initial?.product.id ?? "",
    },
  });

  const errors = form.formState.errors;
  const productId = form.watch("product_id");
  const channel = form.watch("ecommerce");

  function translateError(key: string | undefined): string | undefined {
    if (!key) return undefined;
    return t(key as never);
  }

  const productOptions = products.data?.items ?? [];
  const selectedProduct = productOptions.find((p) => p.id === productId);

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col"
    >
      {/* Channel picker — direct port of design's `channels` grid in
          sales.jsx (5-column grid, brand-coloured chip + name underneath). */}
      <div className={SECTION_HEADING_CLASS} style={{ marginTop: 0 }}>
        {t("sections.channel")}
      </div>
      <Controller
        control={form.control}
        name="ecommerce"
        render={({ field }) => (
          <div className="grid grid-cols-3 gap-2">
            {ECOMMERCE_CHANNELS.map((ch) => {
              const theme = CHANNEL_THEME[ch];
              const selected = field.value === ch;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => field.onChange(ch)}
                  className={cn(
                    "flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[8px] border px-[6px] py-[8px] transition-colors",
                    selected
                      ? "border-[1.5px]"
                      : "border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] hover:bg-[color:var(--orion-surface-2)]",
                  )}
                  style={
                    selected
                      ? {
                          borderColor: theme.color,
                          background: `color-mix(in oklab, ${theme.color} 12%, var(--orion-surface))`,
                        }
                      : undefined
                  }
                >
                  <span
                    className="inline-grid h-6 w-6 place-items-center rounded-[6px] text-[10px] font-bold"
                    style={{ background: theme.color, color: theme.fg }}
                  >
                    {theme.short}
                  </span>
                  <span
                    className="truncate text-[10.5px] leading-tight"
                    style={{
                      color: selected ? "var(--orion-ink)" : "var(--orion-ink-2)",
                    }}
                  >
                    {tChannels(ch)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      />

      <div className={SECTION_HEADING_CLASS}>{t("sections.details")}</div>
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-title`} className={FIELD_LABEL_CLASS}>
          {t("labels.title")}
        </label>
        <Input
          id={`${formId}-title`}
          autoComplete="off"
          placeholder={t("placeholders.title")}
          className={FIELD_INPUT_CLASS}
          aria-invalid={!!errors.title}
          {...form.register("title")}
        />
        {errors.title?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.title.message)}
          </p>
        ) : null}
      </div>

      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-product_id`} className={FIELD_LABEL_CLASS}>
          {t("labels.product")}
        </label>
        <Controller
          control={form.control}
          name="product_id"
          render={({ field }) => (
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-product_id`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className={cn(
                    "h-auto w-full justify-between gap-2",
                    FIELD_INPUT_CLASS,
                    "font-normal",
                  )}
                  aria-invalid={!!errors.product_id}
                >
                  {selectedProduct ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                        {selectedProduct.name}
                      </span>
                      <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                        {selectedProduct.product_type}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.product")}
                    </span>
                  )}
                  <ChevronsUpDown
                    size={14}
                    strokeWidth={1.6}
                    className="text-[color:var(--orion-ink-3)]"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder={t("placeholders.searchProduct")} />
                  <CommandList>
                    <CommandEmpty>{t("noProducts")}</CommandEmpty>
                    <CommandGroup>
                      {productOptions.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.name} ${p.product_type}`}
                          onSelect={() => {
                            field.onChange(p.id);
                            setProductOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn(
                              "mr-2",
                              field.value === p.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex flex-1 flex-col gap-0.5">
                            <span className="text-[13px] text-[color:var(--orion-ink)]">
                              {p.name}
                            </span>
                            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                              {p.product_type}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        />
        {errors.product_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.product_id.message)}
          </p>
        ) : null}
      </div>

      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-external_id`} className={FIELD_LABEL_CLASS}>
          {t("labels.externalId")}
        </label>
        <Input
          id={`${formId}-external_id`}
          autoComplete="off"
          placeholder={t(`placeholders.externalId.${channel as Ecommerce}` as never)}
          className={FIELD_INPUT_CLASS}
          aria-invalid={!!errors.external_id}
          {...form.register("external_id")}
        />
        <p className="text-[11px] text-[color:var(--orion-ink-3)]">
          {t("hints.externalIdOptional")}
        </p>
      </div>
    </form>
  );
}
