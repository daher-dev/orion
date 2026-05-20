"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Layers, Rows3 } from "lucide-react";
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
import { useProducts } from "@/hooks/use-products";
import { useFabricRolls } from "@/hooks/use-fabric";
import {
  cuttingFormSchema,
  type CuttingFormParsed,
  type CuttingFormValues,
} from "@/lib/schemas/cutting";
import { SIZES } from "@/lib/schemas/product";
import { cn } from "@/lib/utils";

type Props = {
  formId: string;
  onSubmit: (values: CuttingFormParsed) => void;
};

const SECTION_HEADING_CLASS =
  "mt-[18px] mb-[10px] flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-prod)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-prod)_16%,transparent)] focus-visible:outline-none";

function fabricRollLabel(code: string, type: string, color: string): string {
  return `${code} · ${type} · ${color}`;
}

function fabricRollCode(id: string): string {
  return `BB-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function CuttingForm({ formId, onSubmit }: Props) {
  const t = useTranslations("cutting.form");
  const products = useProducts({ page_size: 100 });
  const bodyRolls = useFabricRolls({ kind: "body", page_size: 100 });
  const ribRolls = useFabricRolls({ kind: "rib", page_size: 100 });
  const [productOpen, setProductOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [ribOpen, setRibOpen] = useState(false);

  const form = useForm<CuttingFormValues, unknown, CuttingFormParsed>({
    resolver: zodResolver(cuttingFormSchema),
    defaultValues: {
      product_id: "",
      body_roll_id: "",
      rib_roll_id: "",
      sizes: { p: 0, m: 0, g: 0, gg: 0 },
      cut_at: "",
    },
  });

  const errors = form.formState.errors;
  const productOptions = useMemo(() => products.data?.items ?? [], [products.data]);
  const bodyRollOptions = useMemo(() => bodyRolls.data?.items ?? [], [bodyRolls.data]);
  const ribRollOptions = useMemo(() => ribRolls.data?.items ?? [], [ribRolls.data]);

  const productId = form.watch("product_id");
  const bodyRollId = form.watch("body_roll_id");
  const ribRollId = form.watch("rib_roll_id");

  const selectedProduct = useMemo(
    () => productOptions.find((p) => p.id === productId),
    [productId, productOptions],
  );
  const selectedBodyRoll = useMemo(
    () => bodyRollOptions.find((r) => r.id === bodyRollId),
    [bodyRollId, bodyRollOptions],
  );
  const selectedRibRoll = useMemo(
    () => ribRollOptions.find((r) => r.id === ribRollId),
    [ribRollId, ribRollOptions],
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
        {t("sections.product")}
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
                    "h-auto w-full justify-between gap-2 font-normal",
                    FIELD_INPUT_CLASS,
                  )}
                  aria-invalid={!!errors.product_id}
                >
                  {selectedProduct ? (
                    <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                      {selectedProduct.name}
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
                          <span className="flex flex-1 flex-col">
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

      <div className={SECTION_HEADING_CLASS}>{t("sections.rolls")}</div>
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-body_roll_id`} className={FIELD_LABEL_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Layers size={11} strokeWidth={1.6} />
            {t("labels.bodyRoll")}
          </span>
        </label>
        <Controller
          control={form.control}
          name="body_roll_id"
          render={({ field }) => (
            <Popover open={bodyOpen} onOpenChange={setBodyOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-body_roll_id`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={bodyOpen}
                  className={cn(
                    "h-auto w-full justify-between gap-2 font-normal",
                    FIELD_INPUT_CLASS,
                  )}
                  aria-invalid={!!errors.body_roll_id}
                >
                  {selectedBodyRoll ? (
                    <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                      {fabricRollLabel(
                        fabricRollCode(selectedBodyRoll.id),
                        selectedBodyRoll.fabric_type,
                        selectedBodyRoll.color,
                      )}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.bodyRoll")}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={cn(
                      "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                      bodyOpen && "rotate-180",
                    )}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder={t("placeholders.searchRoll")} />
                  <CommandList>
                    <CommandEmpty>{t("noRolls")}</CommandEmpty>
                    <CommandGroup>
                      {bodyRollOptions.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={`${r.fabric_type} ${r.color} ${r.supplier_name}`}
                          onSelect={() => {
                            field.onChange(r.id);
                            setBodyOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn(
                              "mr-2",
                              field.value === r.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex flex-1 flex-col">
                            <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                              {fabricRollCode(r.id)} · {r.fabric_type}
                            </span>
                            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                              {r.color} · {r.current_weight_kg}kg
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
        {errors.body_roll_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.body_roll_id.message)}
          </p>
        ) : null}
      </div>

      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-rib_roll_id`} className={FIELD_LABEL_CLASS}>
          <span className="inline-flex items-center gap-1.5">
            <Rows3 size={11} strokeWidth={1.6} />
            {t("labels.ribRoll")}
            <span className="text-[10px] font-normal text-[color:var(--orion-ink-3)]">
              {t("hints.optional")}
            </span>
          </span>
        </label>
        <Controller
          control={form.control}
          name="rib_roll_id"
          render={({ field }) => (
            <Popover open={ribOpen} onOpenChange={setRibOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-rib_roll_id`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={ribOpen}
                  className={cn(
                    "h-auto w-full justify-between gap-2 font-normal",
                    FIELD_INPUT_CLASS,
                  )}
                  aria-invalid={!!errors.rib_roll_id}
                >
                  {selectedRibRoll ? (
                    <span className="truncate text-[13px] text-[color:var(--orion-ink)]">
                      {fabricRollLabel(
                        fabricRollCode(selectedRibRoll.id),
                        selectedRibRoll.fabric_type,
                        selectedRibRoll.color,
                      )}
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.ribRoll")}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={cn(
                      "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                      ribOpen && "rotate-180",
                    )}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder={t("placeholders.searchRoll")} />
                  <CommandList>
                    <CommandEmpty>{t("noRolls")}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          field.onChange("");
                          setRibOpen(false);
                        }}
                      >
                        <Check
                          size={13}
                          className={cn(
                            "mr-2",
                            !field.value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="text-[12px] italic text-[color:var(--orion-ink-3)]">
                          {t("noRibRoll")}
                        </span>
                      </CommandItem>
                      {ribRollOptions.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={`${r.fabric_type} ${r.color} ${r.supplier_name}`}
                          onSelect={() => {
                            field.onChange(r.id);
                            setRibOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn(
                              "mr-2",
                              field.value === r.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex flex-1 flex-col">
                            <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                              {fabricRollCode(r.id)} · {r.fabric_type}
                            </span>
                            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                              {r.color} · {r.current_weight_kg}kg
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
        {errors.rib_roll_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.rib_roll_id.message)}
          </p>
        ) : null}
      </div>

      {/* Per-size quantities grid — direct port of design's `Peças por
          tamanho` section in production.jsx. The minimum 1-output total
          rule is asserted by the zod schema. */}
      <div className={SECTION_HEADING_CLASS}>
        <span>{t("sections.plannedOutputs")}</span>
      </div>
      <div className="rounded-[10px] border border-[color:var(--orion-line-soft)] overflow-hidden">
        <div
          className="grid grid-cols-4 gap-px bg-[color:var(--orion-line-soft)]"
        >
          {SIZES.map((size) => (
            <div
              key={size}
              className="flex flex-col items-center gap-1.5 bg-[color:var(--orion-surface)] px-2 py-3"
            >
              <span
                className="font-mono text-[13px] font-medium text-[color:var(--orion-ink)]"
              >
                {size.toUpperCase()}
              </span>
              <Controller
                control={form.control}
                name={`sizes.${size}` as const}
                render={({ field }) => (
                  <NumberInput
                    tone="prod"
                    step={1}
                    min={0}
                    decimals={0}
                    align="center"
                    aria-label={size.toUpperCase()}
                    value={field.value}
                    onChange={(next) => field.onChange(next === "" ? 0 : Number(next))}
                    onBlur={field.onBlur}
                  />
                )}
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

      <div className={SECTION_HEADING_CLASS}>{t("sections.schedule")}</div>
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-cut_at`} className={FIELD_LABEL_CLASS}>
          {t("labels.cutAt")}
        </label>
        <Input
          id={`${formId}-cut_at`}
          type="date"
          className={FIELD_INPUT_CLASS}
          {...form.register("cut_at")}
        />
        <p className="text-[11px] text-[color:var(--orion-ink-3)]">
          {t("hints.cutAtOptional")}
        </p>
      </div>
    </form>
  );
}
