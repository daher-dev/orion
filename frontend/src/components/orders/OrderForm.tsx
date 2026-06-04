"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useAds } from "@/hooks/use-ads";
import { useClients } from "@/hooks/use-clients";
import { useProduct } from "@/hooks/use-products";
import { CHANNEL_THEME } from "@/components/ads/AdsGrid";
import {
  orderFormSchema,
  type Order,
  type OrderFormPayload,
  type OrderFormValues,
} from "@/lib/schemas/order";
import { ECOMMERCE_CHANNELS, type Ecommerce } from "@/lib/schemas/ad";
import { cn } from "@/lib/utils";

type Props = {
  formId: string;
  initial?: Order;
  onSubmit: (values: OrderFormPayload) => void;
};

const SECTION_HEADING_CLASS =
  "mt-[18px] mb-[10px] flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-sales)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-sales)_16%,transparent)] focus-visible:outline-none";

function nowLocalIso(): string {
  // Returns an ISO-ish string accepted by datetime-local inputs.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function OrderForm({ formId, initial, onSubmit }: Props) {
  const t = useTranslations("orders.form");
  const tChannels = useTranslations("orders.channels");

  // Load reference data — paginated GETs to keep the network small. For
  // ten-row tenants this is one round-trip per dataset; we cap at 100.
  const clients = useClients({ pageSize: 100 });
  const ads = useAds({ page_size: 100 });

  const [channel, setChannel] = useState<Ecommerce | "all">("all");
  const [clientOpen, setClientOpen] = useState(false);
  const [adOpen, setAdOpen] = useState(false);

  const form = useForm<OrderFormValues, unknown, OrderFormPayload>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      client_id: initial?.client?.id ?? "",
      ad_id: initial?.ad.id ?? "",
      variation_id: initial?.variation.id ?? "",
      quantity: initial?.quantity ?? 1,
      sale_price: initial?.sale_price != null ? Number(initial.sale_price) : 0,
      ordered_at: initial
        ? initial.ordered_at.slice(0, 16)
        : nowLocalIso(),
      external_order_id: initial?.external_order_id ?? "",
    },
  });

  const errors = form.formState.errors;
  const clientId = form.watch("client_id");
  const adId = form.watch("ad_id");

  function translateError(key: string | undefined): string | undefined {
    if (!key) return undefined;
    return t(key as never);
  }

  const clientOptions = useMemo(() => clients.data?.items ?? [], [clients.data?.items]);
  const allAdOptions = useMemo(() => ads.data?.items ?? [], [ads.data?.items]);
  const adOptions = useMemo(
    () => channel === "all" ? allAdOptions : allAdOptions.filter((a) => a.ecommerce === channel),
    [allAdOptions, channel],
  );

  const selectedClient = useMemo(
    () => clientOptions.find((c) => c.id === clientId),
    [clientOptions, clientId],
  );
  const selectedAd = useMemo(() => adOptions.find((a) => a.id === adId), [adOptions, adId]);

  // Cascade: load variations for the product the selected ad points at.
  const product = useProduct(selectedAd?.product.id ?? null);
  const variations = product.data?.variations ?? [];

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col"
    >
      <div className={SECTION_HEADING_CLASS} style={{ marginTop: 0 }}>
        {t("sections.client")}
      </div>

      {/* Client combobox */}
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-client_id`} className={FIELD_LABEL_CLASS}>
          {t("labels.client")}
        </label>
        <Controller
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <Popover open={clientOpen} onOpenChange={setClientOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-client_id`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientOpen}
                  className={cn(
                    "h-auto w-full justify-between gap-2",
                    FIELD_INPUT_CLASS,
                    "font-normal",
                  )}
                  aria-invalid={!!errors.client_id}
                >
                  {selectedClient ? (
                    <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                      {selectedClient.name}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.client")}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={cn(
                      "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                      clientOpen && "rotate-180",
                    )}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("placeholders.searchClient")} />
                  <CommandList>
                    <CommandEmpty>{t("noClients")}</CommandEmpty>
                    <CommandGroup>
                      {clientOptions.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            field.onChange(c.id);
                            setClientOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn(
                              "mr-2",
                              field.value === c.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex flex-1 flex-col gap-0.5">
                            <span className="text-[13px] text-[color:var(--orion-ink)]">{c.name}</span>
                            {c.email ? (
                              <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                                {c.email}
                              </span>
                            ) : null}
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
        {errors.client_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.client_id.message)}
          </p>
        ) : null}
      </div>

      <div className={SECTION_HEADING_CLASS}>{t("sections.items")}</div>

      {/* Channel filter — narrows the ad options shown below */}
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label className={FIELD_LABEL_CLASS}>{t("labels.canal")}</label>
        <Select
          value={channel}
          onValueChange={(v) => {
            setChannel(v as Ecommerce | "all");
            // Reset ad when channel changes so stale cross-channel id is cleared.
            form.setValue("ad_id", "", { shouldValidate: false });
            form.setValue("variation_id", "", { shouldValidate: false });
          }}
        >
          <SelectTrigger className={FIELD_INPUT_CLASS}>
            <SelectValue placeholder={t("placeholders.canal")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("placeholders.canal")}</SelectItem>
            {ECOMMERCE_CHANNELS.map((c) => (
              <SelectItem key={c} value={c}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-grid h-[16px] w-[16px] place-items-center rounded-[3px] text-[8px] font-bold"
                    style={{
                      background: CHANNEL_THEME[c].color,
                      color: CHANNEL_THEME[c].fg,
                    }}
                    aria-hidden="true"
                  >
                    {CHANNEL_THEME[c].short}
                  </span>
                  {tChannels(c)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ad combobox (cascades into product variations) */}
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-ad_id`} className={FIELD_LABEL_CLASS}>
          {t("labels.ad")}
        </label>
        <Controller
          control={form.control}
          name="ad_id"
          render={({ field }) => (
            <Popover open={adOpen} onOpenChange={setAdOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-ad_id`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={adOpen}
                  className={cn(
                    "h-auto w-full justify-between gap-2",
                    FIELD_INPUT_CLASS,
                    "font-normal",
                  )}
                  aria-invalid={!!errors.ad_id}
                >
                  {selectedAd ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="inline-grid h-[18px] w-[18px] place-items-center rounded-[4px] text-[9px] font-bold"
                        style={{
                          background: CHANNEL_THEME[selectedAd.ecommerce].color,
                          color: CHANNEL_THEME[selectedAd.ecommerce].fg,
                        }}
                        aria-hidden="true"
                      >
                        {CHANNEL_THEME[selectedAd.ecommerce].short}
                      </span>
                      <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                        {selectedAd.title}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.ad")}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={cn(
                      "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                      adOpen && "rotate-180",
                    )}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("placeholders.searchAd")} />
                  <CommandList>
                    <CommandEmpty>{t("noAds")}</CommandEmpty>
                    <CommandGroup>
                      {adOptions.map((a) => (
                        <CommandItem
                          key={a.id}
                          value={`${a.title} ${a.product.name}`}
                          onSelect={() => {
                            field.onChange(a.id);
                            // Reset variation when ad changes — the product cascades.
                            form.setValue("variation_id", "", { shouldValidate: false });
                            setAdOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn(
                              "mr-2",
                              field.value === a.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="inline-grid h-[18px] w-[18px] place-items-center rounded-[4px] text-[9px] font-bold"
                              style={{
                                background: CHANNEL_THEME[a.ecommerce].color,
                                color: CHANNEL_THEME[a.ecommerce].fg,
                              }}
                            >
                              {CHANNEL_THEME[a.ecommerce].short}
                            </span>
                            <span className="flex flex-col gap-0.5 min-w-0">
                              <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                                {a.title}
                              </span>
                              <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                                {a.product.name} · {tChannels(a.ecommerce)}
                              </span>
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
        {errors.ad_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.ad_id.message)}
          </p>
        ) : null}
      </div>

      {/* Variation (cascades from ad's product) */}
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-variation_id`} className={FIELD_LABEL_CLASS}>
          {t("labels.variation")}
        </label>
        <Controller
          control={form.control}
          name="variation_id"
          render={({ field }) => (
            <Select
              value={field.value || undefined}
              onValueChange={(v) => field.onChange(v)}
              disabled={!selectedAd}
            >
              <SelectTrigger
                id={`${formId}-variation_id`}
                className={FIELD_INPUT_CLASS}
                aria-invalid={!!errors.variation_id}
              >
                <SelectValue
                  placeholder={
                    variations.length === 0
                      ? t("noVariations")
                      : t("placeholders.variation")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {variations.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] text-[color:var(--orion-ink)]">
                        {v.color}
                      </span>
                      <span className="rounded-[3px] border border-[color:var(--orion-line-soft)] px-[5px] py-px font-mono text-[10px] leading-[1.2] text-[color:var(--orion-ink-3)]">
                        {v.size.toUpperCase()}
                      </span>
                      <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                        {v.sku}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.variation_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.variation_id.message)}
          </p>
        ) : null}
      </div>

      <div className="mb-[14px] grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-quantity`} className={FIELD_LABEL_CLASS}>
            {t("labels.quantity")}
          </label>
          <Controller
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <NumberInput
                id={`${formId}-quantity`}
                tone="sales"
                step={1}
                min={1}
                decimals={0}
                align="right"
                aria-invalid={!!errors.quantity}
                value={field.value as number | string | null | undefined}
                onChange={(next) => field.onChange(next === "" ? 1 : Number(next))}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.quantity?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.quantity.message)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-sale_price`} className={FIELD_LABEL_CLASS}>
            {t("labels.salePrice")}
          </label>
          <Controller
            control={form.control}
            name="sale_price"
            render={({ field }) => (
              <NumberInput
                id={`${formId}-sale_price`}
                tone="sales"
                prefix="R$"
                step={0.01}
                min={0}
                decimals={2}
                align="right"
                aria-invalid={!!errors.sale_price}
                value={field.value as number | string | null | undefined}
                onChange={(next) => field.onChange(next === "" ? 0 : Number(next))}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.sale_price?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.sale_price.message)}
            </p>
          ) : null}
        </div>
      </div>

      <div className={SECTION_HEADING_CLASS}>{t("sections.details")}</div>

      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-ordered_at`} className={FIELD_LABEL_CLASS}>
          {t("labels.orderedAt")}
        </label>
        <Input
          id={`${formId}-ordered_at`}
          type="datetime-local"
          className={FIELD_INPUT_CLASS}
          aria-invalid={!!errors.ordered_at}
          {...form.register("ordered_at")}
        />
        {errors.ordered_at?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.ordered_at.message)}
          </p>
        ) : null}
      </div>

      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-external_order_id`} className={FIELD_LABEL_CLASS}>
          {t("labels.externalOrderId")}
        </label>
        <Input
          id={`${formId}-external_order_id`}
          autoComplete="off"
          placeholder={t("placeholders.externalOrderId")}
          className={FIELD_INPUT_CLASS}
          {...form.register("external_order_id")}
        />
      </div>
    </form>
  );
}
