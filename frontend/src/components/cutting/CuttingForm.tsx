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
import { useSpecsList } from "@/hooks/use-specs";
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
  const specs = useSpecsList();
  const bodyRolls = useFabricRolls({ kind: "body", page_size: 100 });
  const ribRolls = useFabricRolls({ kind: "rib", page_size: 100 });
  const [specOpen, setSpecOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [ribOpen, setRibOpen] = useState(false);

  const form = useForm<CuttingFormValues, unknown, CuttingFormParsed>({
    resolver: zodResolver(cuttingFormSchema),
    defaultValues: {
      spec_id: "",
      color: "",
      color_code: "",
      body_roll_id: "",
      rib_roll_id: "",
      sizes: { p: 0, m: 0, g: 0, gg: 0, u: 0 },
      cut_at: "",
    },
  });

  const errors = form.formState.errors;
  const specOptions = useMemo(() => specs.data ?? [], [specs.data]);
  const bodyRollOptions = useMemo(() => bodyRolls.data?.items ?? [], [bodyRolls.data]);
  const ribRollOptions = useMemo(() => ribRolls.data?.items ?? [], [ribRolls.data]);

  const specId = form.watch("spec_id");
  const bodyRollId = form.watch("body_roll_id");
  const ribRollId = form.watch("rib_roll_id");

  const selectedSpec = useMemo(
    () => specOptions.find((s) => s.id === specId),
    [specId, specOptions],
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
      {/* Ficha técnica (spec) — replaces the old Product selector; cutting is
          now print-agnostic and keyed by the garment base spec. */}
      <div className={SECTION_HEADING_CLASS} style={{ marginTop: 0 }}>
        {t("sections.spec")}
      </div>
      <div className="mb-[14px] flex flex-col gap-1.5">
        <label htmlFor={`${formId}-spec_id`} className={FIELD_LABEL_CLASS}>
          {t("labels.spec")}
        </label>
        <Controller
          control={form.control}
          name="spec_id"
          render={({ field }) => (
            <Popover open={specOpen} onOpenChange={setSpecOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${formId}-spec_id`}
                  data-testid="cutting-spec-trigger"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={specOpen}
                  className={cn(
                    "h-auto w-full justify-between gap-2 font-normal",
                    FIELD_INPUT_CLASS,
                  )}
                  aria-invalid={!!errors.spec_id}
                >
                  {selectedSpec ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                        {selectedSpec.code}
                      </span>
                      <span className="truncate text-[13px] text-[color:var(--orion-ink-2)]">
                        {selectedSpec.name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-[color:var(--orion-ink-3)]">
                      {t("placeholders.spec")}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    strokeWidth={1.6}
                    className={cn(
                      "shrink-0 text-[color:var(--orion-ink-3)] transition-transform duration-150",
                      specOpen && "rotate-180",
                    )}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder={t("placeholders.searchSpec")} />
                  <CommandList>
                    <CommandEmpty>{t("noSpecs")}</CommandEmpty>
                    <CommandGroup>
                      {specOptions.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`${s.code} ${s.name}`}
                          onSelect={() => {
                            field.onChange(s.id);
                            setSpecOpen(false);
                          }}
                        >
                          <Check
                            size={13}
                            className={cn(
                              "mr-2",
                              field.value === s.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="flex flex-1 flex-col">
                            <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                              {s.code}
                            </span>
                            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                              {s.name}
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
        {errors.spec_id?.message ? (
          <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
            {translateError(errors.spec_id.message)}
          </p>
        ) : null}
      </div>

      {/* Cor — free-text colour name + 3-letter auto-uppercased code, mirroring
          the blank-piece / product variation colour pattern. */}
      <div className={SECTION_HEADING_CLASS}>{t("sections.color")}</div>
      <div className="mb-[14px] grid grid-cols-[1fr_120px] gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-color`} className={FIELD_LABEL_CLASS}>
            {t("labels.color")}
          </label>
          <Input
            id={`${formId}-color`}
            data-testid="cutting-color-input"
            className={FIELD_INPUT_CLASS}
            placeholder={t("placeholders.color")}
            aria-invalid={!!errors.color}
            {...form.register("color")}
          />
          {errors.color?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.color.message)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${formId}-color_code`} className={FIELD_LABEL_CLASS}>
            {t("labels.colorCode")}
          </label>
          <Controller
            control={form.control}
            name="color_code"
            render={({ field }) => (
              <Input
                id={`${formId}-color_code`}
                data-testid="cutting-color-code-input"
                className={cn(FIELD_INPUT_CLASS, "font-mono uppercase tracking-[0.12em]")}
                maxLength={3}
                placeholder={t("placeholders.colorCode")}
                aria-invalid={!!errors.color_code}
                value={field.value ?? ""}
                onChange={(e) =>
                  field.onChange(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())
                }
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.color_code?.message ? (
            <p role="alert" className="text-[11.5px] text-[color:var(--status-err)]">
              {translateError(errors.color_code.message)}
            </p>
          ) : null}
        </div>
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

      {/* Per-size quantities grid — iterates SIZES (now incl. `u` / Único). The
          minimum 1-output total rule is asserted by the zod schema. */}
      <div className={SECTION_HEADING_CLASS}>
        <span>{t("sections.plannedOutputs")}</span>
      </div>
      <div className="rounded-[10px] border border-[color:var(--orion-line-soft)] overflow-hidden">
        <div className="grid grid-cols-5 gap-px bg-[color:var(--orion-line-soft)]">
          {SIZES.map((size) => (
            <div
              key={size}
              className="flex flex-col items-center gap-1.5 bg-[color:var(--orion-surface)] px-2 py-3"
            >
              <span className="font-mono text-[13px] font-medium text-[color:var(--orion-ink)]">
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
                    value={field.value as number | string | null | undefined}
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
