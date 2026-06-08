"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
import { GarmentGlyph } from "@/components/ui/garment-glyph";
import { useProducts } from "@/hooks/use-products";
import {
  ECOMMERCE_CHANNELS,
  adFormSchema,
  type Ad,
  type AdFormPayload,
  type AdFormValues,
  type Ecommerce,
} from "@/lib/schemas/ad";
import { SIZES, type Product, type Size } from "@/lib/schemas/product";
import { CHANNEL_THEME } from "./AdsGrid";
import { cn } from "@/lib/utils";

/**
 * Derive a short "code" for a product from its first variation's SKU.
 * SKUs in Orion follow `{productCode}-{size}-{colorCode}` (e.g.
 * `CAM01-M-BLK`), so we take the leading segment. Falls back to the
 * product type label when no variation is present.
 */
function productCode(product: Product): string {
  const first = product.variations[0];
  if (first?.sku) return first.sku.split("-")[0];
  return product.product_type.toUpperCase();
}

/**
 * Deduplicate variation colors, preserving insertion order. Used for the
 * little color-dot row in the rich product option.
 */
function distinctColors(product: Product): { color: string; hex: string }[] {
  const seen = new Set<string>();
  const out: { color: string; hex: string }[] = [];
  for (const v of product.variations) {
    if (seen.has(v.color_code)) continue;
    seen.add(v.color_code);
    out.push({ color: v.color, hex: colorHex(v.color_code) });
  }
  return out;
}

/**
 * Map a 3-letter color code to a CSS hex. The set is intentionally
 * narrow — codes outside it fall back to a warm neutral.
 */
function colorHex(code: string): string {
  const map: Record<string, string> = {
    BLK: "#1f1b15",
    WHT: "#f5f0e8",
    GRY: "#7a7160",
    NVY: "#1e293b",
    RED: "#b91c1c",
    GRN: "#15803d",
    BLU: "#1e40af",
    YEL: "#eab308",
    PNK: "#ec4899",
    BRW: "#7c4a1e",
    BEG: "#d4b896",
    MNT: "#a7d3c2",
  };
  return map[code] ?? "#a8a098";
}

function distinctSizes(product: Product): Size[] {
  const seen = new Set<Size>();
  for (const v of product.variations) seen.add(v.size);
  return SIZES.filter((s) => seen.has(s));
}

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
      product_ids: initial?.products.map((p) => p.id) ?? [],
    },
  });

  const errors = form.formState.errors;
  const productIds = form.watch("product_ids");
  const channel = form.watch("ecommerce");

  function translateError(key: string | undefined): string | undefined {
    if (!key) return undefined;
    return t(key as never);
  }

  const productOptions = useMemo(
    () => products.data?.items ?? [],
    [products.data?.items],
  );
  const selectedProducts = useMemo(
    () => productOptions.filter((p) => productIds.includes(p.id)),
    [productOptions, productIds],
  );

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
        <label htmlFor={`${formId}-product_ids`} className={FIELD_LABEL_CLASS}>
          {t("labels.product")}
        </label>
        <Controller
          control={form.control}
          name="product_ids"
          render={({ field }) => (
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-product_ids`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className={cn(
                    "h-auto min-h-[38px] w-full justify-between gap-2",
                    FIELD_INPUT_CLASS,
                    "font-normal",
                  )}
                  aria-invalid={!!errors.product_ids}
                >
                  {selectedProducts.length > 0 ? (
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      {selectedProducts.map((sp) => (
                        <span
                          key={sp.id}
                          className="flex min-w-0 items-center gap-1.5 rounded-[5px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-1.5 py-0.5"
                        >
                          <GarmentGlyph productType={sp.product_type} size={12} />
                          <span className="truncate text-[12px] text-[color:var(--orion-ink)]">
                            {sp.name}
                          </span>
                          <span className="font-mono text-[10px] text-[color:var(--orion-ink-3)]">
                            {productCode(sp)}
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.product")}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={cn(
                      "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                      productOpen && "rotate-180",
                    )}
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
                      {productOptions.map((p) => {
                        const colors = distinctColors(p);
                        const sizes = distinctSizes(p);
                        const selected = field.value.includes(p.id);
                        return (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${productCode(p)} ${p.product_type}`}
                            onSelect={() => {
                              const next = new Set(field.value);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              field.onChange([...next]);
                            }}
                            className="gap-2.5"
                          >
                            <span
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-2)]"
                              aria-hidden="true"
                            >
                              <GarmentGlyph productType={p.product_type} size={14} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                                  {p.name}
                                </span>
                                <span className="font-mono text-[10.5px] text-[color:var(--orion-ink-3)]">
                                  {productCode(p)}
                                </span>
                              </span>
                              <span className="flex items-center gap-2">
                                {colors.length > 0 ? (
                                  <span className="flex gap-[3px]">
                                    {colors.slice(0, 6).map((c) => (
                                      <span
                                        key={c.color}
                                        className="inline-block h-2.5 w-2.5 rounded-full border border-[color:var(--orion-line-soft)]"
                                        style={{
                                          background: c.hex,
                                          boxShadow:
                                            "inset 0 0 0 1px rgba(0,0,0,.04)",
                                        }}
                                        title={c.color}
                                      />
                                    ))}
                                  </span>
                                ) : null}
                                {colors.length > 0 && sizes.length > 0 ? (
                                  <span className="h-2.5 w-px bg-[color:var(--orion-line-soft)]" />
                                ) : null}
                                {sizes.length > 0 ? (
                                  <span className="flex gap-[3px]">
                                    {sizes.map((s) => (
                                      <span
                                        key={s}
                                        className="rounded-[3px] border border-[color:var(--orion-line-soft)] px-[5px] py-px font-mono text-[10px] leading-[1.2] text-[color:var(--orion-ink-3)]"
                                      >
                                        {s.toUpperCase()}
                                      </span>
                                    ))}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            {selected ? (
                              <Check
                                size={13}
                                className="shrink-0 text-[color:var(--brand-sales)]"
                              />
                            ) : null}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        />
        {errors.product_ids?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.product_ids.message)}
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
