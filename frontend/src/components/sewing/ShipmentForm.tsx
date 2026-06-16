"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Factory, Scissors } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
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
import { useAvailableCuts } from "@/hooks/use-cutting";
import {
  shipmentFormSchema,
  type ShipmentFormParsed,
  type ShipmentFormValues,
} from "@/lib/schemas/sewing";
import { type AvailableCut } from "@/lib/schemas/cutting";
import { SIZES, type Size } from "@/lib/schemas/product";
import { cn } from "@/lib/utils";

type Props = {
  formId: string;
  onSubmit: (values: ShipmentFormParsed) => void;
  /**
   * When the user opened the form from an available-cut card, this locks the
   * cutting order and clamps each size's `max` to availability. Without it the
   * user picks from the available-cuts combobox.
   */
  prefill?: AvailableCut | null;
};

const SECTION_HEADING_CLASS =
  "mt-[18px] mb-[10px] flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-prod)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-prod)_16%,transparent)] focus-visible:outline-none";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ZERO_SIZES: Record<Size, number> = { p: 0, m: 0, g: 0, gg: 0, u: 0 };

function availableMap(cut: AvailableCut | null | undefined): Record<Size, number> {
  const out: Record<Size, number> = { ...ZERO_SIZES };
  for (const s of cut?.sizes ?? []) out[s.size] = s.available;
  return out;
}

export function ShipmentForm({ formId, onSubmit, prefill }: Props) {
  const t = useTranslations("sewing.form");
  const contractors = useContractors({ page_size: 100 });
  // The remessa source is the set of DONE cutting orders with remaining pieces.
  const availableCuts = useAvailableCuts({ page_size: 100 });

  const [contractorOpen, setContractorOpen] = useState(false);
  const [cuttingOpen, setCuttingOpen] = useState(false);

  const form = useForm<ShipmentFormValues, unknown, ShipmentFormParsed>({
    resolver: zodResolver(shipmentFormSchema),
    defaultValues: {
      cutting_order_id: prefill?.cutting_order_id ?? "",
      contractor_id: "",
      sent_at: todayIso(),
      sizes: { ...ZERO_SIZES },
    },
  });

  const errors = form.formState.errors;

  const contractorOptions = useMemo(
    () => contractors.data?.items ?? [],
    [contractors.data],
  );
  const cutOptions = useMemo(() => availableCuts.data?.items ?? [], [availableCuts.data]);

  const contractorId = form.watch("contractor_id");
  const cuttingOrderId = form.watch("cutting_order_id");

  const selectedContractor = useMemo(
    () => contractorOptions.find((c) => c.id === contractorId),
    [contractorId, contractorOptions],
  );
  // Prefer the prefill (the card the user clicked); otherwise resolve from the
  // loaded available-cuts list so the per-size maxes track the selection.
  const selectedCut = useMemo(
    () => prefill ?? cutOptions.find((c) => c.cutting_order_id === cuttingOrderId) ?? null,
    [prefill, cuttingOrderId, cutOptions],
  );

  const maxBySize = useMemo(() => availableMap(selectedCut), [selectedCut]);

  // When the cutting order changes, clamp any over-max size inputs down.
  useEffect(() => {
    const current = form.getValues("sizes");
    let changed = false;
    const next = { ...current } as Record<Size, number>;
    for (const s of SIZES) {
      const v = Number(current[s]) || 0;
      const max = maxBySize[s];
      if (v > max) {
        next[s] = max;
        changed = true;
      }
    }
    if (changed) form.setValue("sizes", next, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuttingOrderId, prefill]);

  function translateError(key: string | undefined): string | undefined {
    if (!key) return undefined;
    return t(key as never);
  }

  const cuttingLocked = !!prefill;

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
        {cuttingLocked && selectedCut ? (
          // Locked source — opened from an available-cut card.
          <div
            data-testid="sewing-form-locked-cut"
            className="flex items-center gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px]"
          >
            <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
              {selectedCut.spec.code}
            </span>
            <span className="text-[12px] text-[color:var(--orion-ink-2)]">
              {selectedCut.spec.name}
            </span>
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">{selectedCut.color}</span>
            <span className="ml-auto font-mono text-[11px] text-[color:var(--orion-ink-3)]">
              {selectedCut.code}
            </span>
          </div>
        ) : (
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
                    {selectedCut ? (
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                          {selectedCut.spec.code}
                        </span>
                        <span className="truncate text-[12px] text-[color:var(--orion-ink-3)]">
                          {selectedCut.spec.name} · {selectedCut.color}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                        {t("placeholders.cuttingOrder")}
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      strokeWidth={1.6}
                      className={cn(
                        "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                        cuttingOpen && "rotate-180",
                      )}
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
                        {cutOptions.map((c) => (
                          <CommandItem
                            key={c.cutting_order_id}
                            value={`${c.spec.code} ${c.spec.name} ${c.color} ${c.code}`}
                            onSelect={() => {
                              field.onChange(c.cutting_order_id);
                              setCuttingOpen(false);
                            }}
                          >
                            <Check
                              size={13}
                              className={cn(
                                "mr-2",
                                field.value === c.cutting_order_id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="flex flex-1 flex-col">
                              <span className="flex items-center gap-2">
                                <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                                  {c.spec.code}
                                </span>
                                <span className="text-[12px] text-[color:var(--orion-ink-2)]">
                                  {c.spec.name}
                                </span>
                              </span>
                              <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                                {c.color} · {t("availableCount", { count: c.total_available })}
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
        )}
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
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={cn(
                      "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                      contractorOpen && "rotate-180",
                    )}
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

      {/* Per-size requested grid — each input is clamped to the available cut
          count for that size (soft client guard; backend re-validates). Only
          sizes with availability are shown when a cut is selected. */}
      <div className={SECTION_HEADING_CLASS}>{t("sections.items")}</div>
      <div className="rounded-[10px] border border-[color:var(--orion-line-soft)] overflow-hidden">
        <div className="grid grid-cols-5 gap-px bg-[color:var(--orion-line-soft)]">
          {SIZES.map((size) => {
            const max = maxBySize[size];
            const dimmed = !!selectedCut && max <= 0;
            return (
              <div
                key={size}
                className="flex flex-col items-center gap-1.5 bg-[color:var(--orion-surface)] px-2 py-3"
                style={{ opacity: dimmed ? 0.4 : 1 }}
              >
                <span className="font-mono text-[13px] font-medium text-[color:var(--orion-ink)]">
                  {size.toUpperCase()}
                </span>
                {selectedCut ? (
                  <span className="text-[10px] text-[color:var(--orion-ink-3)]">/ {max}</span>
                ) : null}
                <Controller
                  control={form.control}
                  name={`sizes.${size}` as const}
                  render={({ field }) => (
                    <NumberInput
                      tone="prod"
                      step={1}
                      min={0}
                      max={selectedCut ? max : undefined}
                      decimals={0}
                      align="center"
                      aria-label={size.toUpperCase()}
                      disabled={dimmed}
                      value={field.value as number | string | null | undefined}
                      onChange={(next) => field.onChange(next === "" ? 0 : Number(next))}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              </div>
            );
          })}
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
