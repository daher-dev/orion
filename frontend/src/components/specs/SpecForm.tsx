"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { ApiError } from "@/lib/api-client";
import {
  FABRIC_TYPES,
  type FabricType,
  type SpecCreate,
  type SpecRead,
  type TrimType,
} from "@/lib/schemas/spec";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrimRow, type TrimRowValue } from "./TrimRow";

type FormState = {
  code: string;
  name: string;
  fabric_type: FabricType;
  fabric_grammage_gsm: string;
  fabric_weight_per_piece_g: string;
  has_ribana: boolean;
  ribana_weight_pct: string;
  labor_cost: string;
  sale_price: string;
  notes: string;
  trims: TrimRowValue[];
};

export type SpecFormSubmit = SpecCreate;

const EMPTY_TRIM: TrimRowValue = { trim_type: "label", unit_price: "0.00", quantity: 1 };

function initialFromSpec(spec: SpecRead | null): FormState {
  if (!spec) {
    return {
      code: "",
      name: "",
      fabric_type: "jersey",
      fabric_grammage_gsm: "180",
      fabric_weight_per_piece_g: "250",
      has_ribana: false,
      ribana_weight_pct: "",
      labor_cost: "0.00",
      sale_price: "0.00",
      notes: "",
      trims: [],
    };
  }
  return {
    code: spec.code,
    name: spec.name,
    fabric_type: spec.fabric_type,
    fabric_grammage_gsm: String(spec.fabric_grammage_gsm),
    fabric_weight_per_piece_g: spec.fabric_weight_per_piece_g,
    has_ribana: spec.has_ribana,
    ribana_weight_pct: spec.ribana_weight_pct ?? "",
    labor_cost: spec.labor_cost,
    sale_price: spec.sale_price ?? "",
    notes: spec.notes ?? "",
    trims: spec.trims.map((t) => ({
      trim_type: t.trim_type as TrimType,
      unit_price: t.unit_price,
      quantity: t.quantity,
    })),
  };
}

/**
 * The big editor used for both create + edit. Sections mirror the design's
 * `.section-title` rhythm — uppercase 11px / 0.1em / 600 ink-3 eyebrow with
 * line-soft underline, followed by the actual fields.
 */
export function SpecForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  apiError,
}: {
  initial: SpecRead | null;
  submitting: boolean;
  onSubmit: (payload: SpecFormSubmit) => Promise<void> | void;
  onCancel?: () => void;
  apiError?: ApiError | null;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [state, setState] = useState<FormState>(() => initialFromSpec(initial));
  const [error, setError] = useState<string | null>(null);

  // Live cost preview — direct port of design source's NewSpecSheet bottom card.
  const { trimsTotal, totalCost, margin } = useMemo(() => {
    const trimsSum = state.trims.reduce(
      (sum, trim) => sum + Number(trim.unit_price || 0) * (trim.quantity || 0),
      0,
    );
    const labor = Number(state.labor_cost || 0);
    const total = trimsSum + labor;
    const sale = Number(state.sale_price || 0);
    const grossMargin = sale > 0 ? ((sale - total) / sale) * 100 : 0;
    return { trimsTotal: trimsSum, totalCost: total, margin: grossMargin };
  }, [state.labor_cost, state.sale_price, state.trims]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const addTrim = () => {
    setState((prev) => ({ ...prev, trims: [...prev.trims, { ...EMPTY_TRIM }] }));
  };
  const updateTrim = (index: number, next: TrimRowValue) => {
    setState((prev) => ({
      ...prev,
      trims: prev.trims.map((t, i) => (i === index ? next : t)),
    }));
  };
  const removeTrim = (index: number) => {
    setState((prev) => ({ ...prev, trims: prev.trims.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (state.has_ribana && !state.ribana_weight_pct) {
      setError(t("specs.form.validation.ribanaPctRequired"));
      return;
    }

    const payload: SpecCreate = {
      code: state.code,
      name: state.name,
      fabric_type: state.fabric_type,
      fabric_grammage_gsm: Number(state.fabric_grammage_gsm),
      fabric_weight_per_piece_g: state.fabric_weight_per_piece_g,
      has_ribana: state.has_ribana,
      ribana_weight_pct: state.has_ribana ? state.ribana_weight_pct : null,
      labor_cost: state.labor_cost,
      sale_price: state.sale_price || null,
      notes: state.notes || null,
      trims: state.trims.map((t) => ({
        trim_type: t.trim_type,
        unit_price: t.unit_price,
        quantity: t.quantity,
      })),
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setError(t("specs.form.validation.duplicateCode"));
        else setError(err.detail);
        return;
      }
      throw err;
    }
  };

  const surfacedError =
    error ??
    (apiError
      ? apiError.status === 409
        ? t("specs.form.validation.duplicateCode")
        : apiError.detail
      : null);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-[640px] flex-col gap-6"
      data-testid="spec-form"
      noValidate
    >
      {/* IDENTIFICAÇÃO */}
      <FormSection title={t("specs.form.sections.identity")}>
        <FormField>
          <Label htmlFor="spec-code">{t("specs.form.labels.code")}</Label>
          <Input
            id="spec-code"
            value={state.code}
            onChange={(e) => setField("code", e.target.value)}
            placeholder={t("specs.form.placeholders.code")}
            required
            maxLength={20}
            data-testid="spec-form-code"
          />
        </FormField>
        <FormField>
          <Label htmlFor="spec-name">{t("specs.form.labels.name")}</Label>
          <Input
            id="spec-name"
            value={state.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder={t("specs.form.placeholders.name")}
            required
            maxLength={120}
            data-testid="spec-form-name"
          />
        </FormField>
      </FormSection>

      {/* TECIDO */}
      <FormSection title={t("specs.form.sections.fabric")}>
        <FormField>
          <Label htmlFor="spec-fabric">{t("specs.form.labels.fabricType")}</Label>
          <Select
            value={state.fabric_type}
            onValueChange={(v) => setField("fabric_type", v as FabricType)}
          >
            <SelectTrigger id="spec-fabric" className="w-full" data-testid="spec-form-fabric">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FABRIC_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`specs.fabricTypes.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField>
            <Label htmlFor="spec-gsm">{t("specs.form.labels.gsm")}</Label>
            <NumberInput
              id="spec-gsm"
              tone="catalog"
              suffix="g/m²"
              step={5}
              min={0}
              decimals={0}
              align="right"
              value={state.fabric_grammage_gsm}
              onChange={(next) => setField("fabric_grammage_gsm", next)}
              data-testid="spec-form-gsm"
            />
          </FormField>
          <FormField>
            <Label htmlFor="spec-weight">{t("specs.form.labels.weightPerPiece")}</Label>
            <NumberInput
              id="spec-weight"
              tone="catalog"
              suffix="g"
              step={0.01}
              min={0}
              decimals={2}
              align="right"
              value={state.fabric_weight_per_piece_g}
              onChange={(next) => setField("fabric_weight_per_piece_g", next)}
              data-testid="spec-form-weight"
            />
          </FormField>
        </div>
      </FormSection>

      {/* RIBANA */}
      <FormSection title={t("specs.form.sections.ribana")}>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="spec-has-ribana" className="text-[13px] normal-case tracking-normal text-[color:var(--orion-ink-2)]">
            {t("specs.form.labels.hasRibana")}
          </Label>
          <Switch
            id="spec-has-ribana"
            checked={state.has_ribana}
            onCheckedChange={(checked) => setField("has_ribana", Boolean(checked))}
            data-testid="spec-form-has-ribana"
          />
        </div>
        {state.has_ribana ? (
          <FormField>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="spec-ribana-pct">{t("specs.form.labels.ribanaPct")}</Label>
              <span className="text-[12px] font-semibold tabular-nums text-[color:var(--orion-ink-2)]">
                {state.ribana_weight_pct || "0"}%
              </span>
            </div>
            <input
              id="spec-ribana-pct"
              type="range"
              min={0}
              max={30}
              step={1}
              value={state.ribana_weight_pct || "0"}
              onChange={(e) => setField("ribana_weight_pct", e.target.value)}
              className="ribana-slider relative h-9 w-full appearance-none bg-transparent"
              style={
                {
                  background: `linear-gradient(to right, var(--brand-catalog) 0%, var(--brand-catalog) ${(Number(state.ribana_weight_pct) || 0) * (100 / 30)}%, var(--orion-surface-2) ${(Number(state.ribana_weight_pct) || 0) * (100 / 30)}%, var(--orion-surface-2) 100%)`,
                  borderRadius: 999,
                  height: 6,
                  marginTop: 16,
                  marginBottom: 16,
                } as React.CSSProperties
              }
              data-testid="spec-form-ribana-pct"
            />
          </FormField>
        ) : null}
      </FormSection>

      {/* AVIAMENTOS */}
      <FormSection title={t("specs.form.sections.cost")}>
        <div className="flex flex-col gap-2">
          {state.trims.length === 0 ? (
            <p className="text-[12px] text-[color:var(--orion-ink-3)]" data-testid="spec-form-no-trims">
              {t("specs.actions.addTrim")}
            </p>
          ) : null}
          {state.trims.map((trim, index) => (
            <TrimRow
              key={index}
              index={index}
              value={trim}
              onChange={(next) => updateTrim(index, next)}
              onRemove={() => removeTrim(index)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addTrim}
          className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md px-2 py-1.5 text-[13px] font-medium text-[color:var(--brand-catalog)] transition-colors hover:bg-[color:var(--orion-surface-2)]"
          data-testid="spec-form-add-trim"
        >
          <Plus className="size-3.5" /> {t("specs.actions.addTrim")}
        </button>
      </FormSection>

      {/* CUSTO & PREÇO */}
      <FormSection title={t("specs.form.sections.pricing")}>
        <div className="grid grid-cols-2 gap-3">
          <FormField>
            <Label htmlFor="spec-labor">{t("specs.form.labels.laborCost")}</Label>
            <NumberInput
              id="spec-labor"
              tone="catalog"
              prefix="R$"
              step={0.5}
              min={0}
              decimals={2}
              align="right"
              value={state.labor_cost}
              onChange={(next) => setField("labor_cost", next)}
              data-testid="spec-form-labor"
            />
          </FormField>
          <FormField>
            <Label htmlFor="spec-sale">{t("specs.form.labels.salePrice")}</Label>
            <NumberInput
              id="spec-sale"
              tone="catalog"
              prefix="R$"
              step={1}
              min={0}
              decimals={2}
              align="right"
              value={state.sale_price}
              onChange={(next) => setField("sale_price", next)}
              data-testid="spec-form-sale"
            />
          </FormField>
        </div>
        {/*
         * Live cost preview block — direct port from /docs/design/source/pages/catalog.jsx
         * (`NewSpecSheet`, "Custo total estimado" card). Surface-2 background, serif
         * 16px total, and a margin line that goes green / ink / warn depending on the
         * percentage.
         */}
        <div
          className="mt-1 flex items-center justify-between gap-3 rounded-[8px] bg-[color:var(--orion-surface-2)] px-[14px] py-[10px] text-[12.5px]"
          data-testid="spec-form-cost-summary"
        >
          <span className="text-[color:var(--orion-ink-2)]">
            {t("specs.detail.stats.totalCost")}{" "}
            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
              (
              {t("specs.form.labels.laborCost").toLowerCase()} +{" "}
              {t("specs.form.sections.cost").toLowerCase()})
            </span>
          </span>
          <span
            className="font-serif text-[16px] text-[color:var(--orion-ink)]"
            data-testid="spec-form-cost-total"
          >
            {format.number(totalCost, { style: "currency", currency: "BRL" })}
          </span>
        </div>
        {Number(state.sale_price || 0) > 0 ? (
          <div
            className="mt-2 flex items-center justify-between px-[14px] text-[12px] text-[color:var(--orion-ink-3)]"
            data-testid="spec-form-margin"
          >
            <span>{t("specs.detail.stats.margin")}</span>
            <span
              className="font-medium tabular-nums"
              style={{
                color:
                  margin > 50
                    ? "var(--status-ok)"
                    : margin > 30
                      ? "var(--orion-ink-2)"
                      : "var(--status-warn)",
              }}
            >
              {margin.toFixed(1)}%
            </span>
          </div>
        ) : null}
        <span className="sr-only" data-testid="spec-form-trims-subtotal">
          {trimsTotal.toFixed(2)}
        </span>
      </FormSection>

      {/* NOTES */}
      <FormSection title={t("specs.form.sections.notes")}>
        <FormField>
          <Label htmlFor="spec-notes" className="sr-only">
            {t("specs.form.labels.notes")}
          </Label>
          <Textarea
            id="spec-notes"
            value={state.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder={t("specs.form.placeholders.notes")}
            rows={3}
            data-testid="spec-form-notes"
          />
        </FormField>
      </FormSection>

      {surfacedError ? (
        <div role="alert" className="rounded-md border border-[color:var(--status-err)] bg-[color:var(--orion-surface-2)] px-3 py-2 text-[13px] text-[color:var(--status-err)]" data-testid="spec-form-error">
          {surfacedError}
        </div>
      ) : null}

      <footer className="flex items-center justify-end gap-2 border-t border-[color:var(--orion-line-soft)] pt-4">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            {t("specs.actions.cancel")}
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={submitting}
          data-testid="spec-form-submit"
          className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
          style={{
            borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)",
          }}
        >
          {t("specs.actions.save")}
        </Button>
      </footer>
    </form>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <header
        className="border-b border-[color:var(--orion-line-soft)] pb-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]"
        data-testid="spec-form-section-eyebrow"
      >
        {title}
      </header>
      {children}
    </section>
  );
}

function FormField({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}
