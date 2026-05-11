"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Factory, Scissors } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useContractors } from "@/hooks/use-contractors";
import { useCuttingOrders } from "@/hooks/use-cutting";
import {
  shipmentFormSchema,
  type ShipmentFormParsed,
  type ShipmentFormValues,
} from "@/lib/schemas/sewing";
import { SIZES } from "@/lib/schemas/product";
import { cn } from "@/lib/utils";

type Props = {
  formId: string;
  onSubmit: (values: ShipmentFormParsed) => void;
};

const SECTION_HEADING_CLASS =
  "mt-[18px] mb-[10px] flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-prod)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-prod)_16%,transparent)] focus-visible:outline-none";

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ShipmentForm({ formId, onSubmit }: Props) {
  const t = useTranslations("sewing.form");
  const contractors = useContractors({ page_size: 100 });
  // Cutting orders feeding sewing should be in "done" status to ensure
  // they have pieces to ship; we still let the user pick anything so the
  // backend's domain check is the source of truth.
  const cuttingOrders = useCuttingOrders({ page_size: 100 });

  const [contractorOpen, setContractorOpen] = useState(false);
  const [cuttingOpen, setCuttingOpen] = useState(false);

  const form = useForm<ShipmentFormValues, unknown, ShipmentFormParsed>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      cutting_order_id: "",
      contractor_id: "",
      sent_at: todayIso(),
      sizes: { p: 0, m: 0, g: 0, gg: 0 },
    },
  });

  const errors = form.formState.errors;

  const contractorOptions = useMemo(
    () => contractors.data?.items ?? [],
    [contractors.data],
  );
  const cuttingOptions = useMemo(
    () => cuttingOrders.data?.items ?? [],
    [cuttingOrders.data],
  );
  const contractorId = form.watch("contractor_id");
  const cuttingOrderId = form.watch("cutting_order_id");

  const selectedContractor = useMemo(
    () => contractorOptions.find((c) => c.id === contractorId),
    [contractorId, contractorOptions],
  );
  const selectedCutting = useMemo(
    () => cuttingOptions.find((c) => c.id === cuttingOrderId),
    [cuttingOrderId, cuttingOptions],
  );

  function translateError(key: string | undefined): string | undefined {
    if (!key) return undefined;
    return t(key as never);
  }

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col"
    >
      <div className={SECTION_HEADING_CLASS} style={{ marginTop: 0 }}>
        {t("sections.source")}
      </div>

      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-cutting_order_id`} className={FIELD_LABEL_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Scissors size={11} strokeWidth={1.6} />
            {t("labels.cuttingOrder")}
          </span>
        </label>
        <Controller
          control={form.control}
          name="cutting_order_id"
          render={({ field }) => (
            <Popover open={cuttingOpen} onOpenChange={setCuttingOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-cutting_order_id`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={cuttingOpen}
                  className={cn(
                    "h-auto w-full justify-between gap-2 font-normal",
                    FIELD_INPUT_CLASS,
                  )}
                  aria-invalid={!!errors.cutting_order_id}
                >
                  {selectedCutting ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                        {shortId(selectedCutting.id)}
                      </span>
                      <span className="truncate text-[12px] text-[color:var(--orion-ink-3)]">
                        {selectedCutting.product.name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.cuttingOrder")}
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
                  <CommandInput placeholder={t("placeholders.searchCutting")} />
                  <CommandList>
                    <CommandEmpty>{t("noCutting")}</CommandEmpty>
                    <CommandGroup>
                      {cuttingOptions.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.product.name} ${c.product.code ?? ""} ${shortId(c.id)}`}
                          onSelect={() => {
                            field.onChange(c.id);
                            setCuttingOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn(
                              "mr-2",
                              field.value === c.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex flex-1 flex-col">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                                {shortId(c.id)}
                              </span>
                              <span className="text-[12px] text-[color:var(--orion-ink-2)]">
                                {c.product.name}
                              </span>
                            </span>
                            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                              {c.status}
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
        {errors.cutting_order_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.cutting_order_id.message)}
          </p>
        ) : null}
      </div>

      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-contractor_id`} className={FIELD_LABEL_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Factory size={11} strokeWidth={1.6} />
            {t("labels.contractor")}
          </span>
        </label>
        <Controller
          control={form.control}
          name="contractor_id"
          render={({ field }) => (
            <Popover open={contractorOpen} onOpenChange={setContractorOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-contractor_id`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={contractorOpen}
                  className={cn(
                    "h-auto w-full justify-between gap-2 font-normal",
                    FIELD_INPUT_CLASS,
                  )}
                  aria-invalid={!!errors.contractor_id}
                >
                  {selectedContractor ? (
                    <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                      {selectedContractor.name}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.contractor")}
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
                  <CommandInput placeholder={t("placeholders.searchContractor")} />
                  <CommandList>
                    <CommandEmpty>{t("noContractors")}</CommandEmpty>
                    <CommandGroup>
                      {contractorOptions.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            field.onChange(c.id);
                            setContractorOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn(
                              "mr-2",
                              field.value === c.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex flex-1 flex-col">
                            <span className="text-[13px] text-[color:var(--orion-ink)]">
                              {c.name}
                            </span>
                            {c.address ? (
                              <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                                {c.address}
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
        {errors.contractor_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.contractor_id.message)}
          </p>
        ) : null}
      </div>

      <div className={SECTION_HEADING_CLASS}>{t("sections.schedule")}</div>
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-sent_at`} className={FIELD_LABEL_CLASS}>
          {t("labels.sentAt")}
        </label>
        <Input
          id={`${formId}-sent_at`}
          type="date"
          className={FIELD_INPUT_CLASS}
          aria-invalid={!!errors.sent_at}
          {...form.register("sent_at")}
        />
        {errors.sent_at?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.sent_at.message)}
          </p>
        ) : null}
      </div>

      <div className={SECTION_HEADING_CLASS}>{t("sections.items")}</div>
      <div className="rounded-[10px] border border-[color:var(--orion-line-soft)] overflow-hidden">
        <div className="grid grid-cols-4 gap-px bg-[color:var(--orion-line-soft)]">
          {SIZES.map((size) => (
            <div
              key={size}
              className="flex flex-col items-center gap-1.5 bg-[color:var(--orion-surface)] px-2 py-3"
            >
              <span className="font-mono text-[13px] font-medium text-[color:var(--orion-ink)]">
                {size.toUpperCase()}
              </span>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                className={cn(FIELD_INPUT_CLASS, "h-auto w-full max-w-[68px] text-center")}
                {...form.register(`sizes.${size}` as const, { valueAsNumber: true })}
              />
            </div>
          ))}
        </div>
      </div>
      {errors.sizes?.p?.message ? (
        <p role="alert" className="mt-1.5 text-[11.5px] text-[color:var(--status-err)]">
          {translateError(errors.sizes.p.message)}
        </p>
      ) : null}
    </form>
  );
}
