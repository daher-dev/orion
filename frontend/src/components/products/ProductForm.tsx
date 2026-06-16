"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, ChevronDown, FileText, Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePrints } from "@/hooks/use-prints";
import { useSpecs } from "@/hooks/use-specs";
import { ApiError } from "@/lib/api-client";
import {
  PRODUCT_TYPES,
  type Product,
  type ProductCreate,
  type ProductType,
  type Size,
} from "@/lib/schemas/product";
import {
  VariationsBuilder,
  buildVariationItems,
  type ColorRow,
} from "./VariationsBuilder";

type Props = {
  formId: string;
  initial?: Product | null;
  onSubmit: (payload: ProductCreate) => Promise<void> | void;
  onError?: (err: ApiError) => void;
};

const LABEL_CLASS =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";

function initialColors(p: Product | null | undefined): ColorRow[] {
  if (!p) return [];
  const seen = new Set<string>();
  const colors: ColorRow[] = [];
  for (const v of p.variations) {
    if (seen.has(v.color_code)) continue;
    seen.add(v.color_code);
    colors.push({ name: v.color, color_code: v.color_code });
  }
  return colors;
}

function initialSizes(p: Product | null | undefined): Size[] {
  if (!p) return [];
  const set = new Set<Size>();
  for (const v of p.variations) set.add(v.size);
  return Array.from(set);
}

export function ProductForm({ formId, initial, onSubmit, onError }: Props) {
  const t = useTranslations("products");
  const tValidation = useTranslations("products.form.validation");

  // Re-initialise the form state whenever the parent passes a different
  // product. We compare by id so the comparison is stable across re-renders
  // (the parent will pass a new `initial` object identity on each load).
  const initialId = initial?.id ?? null;
  const [snapshotId, setSnapshotId] = useState<string | null>(initialId);
  const [name, setName] = useState(initial?.name ?? "");
  const [productType, setProductType] = useState<ProductType>(initial?.product_type ?? "tshirt");
  const [specId, setSpecId] = useState<string>(initial?.spec_id ?? "");
  const [printId, setPrintId] = useState<string | null>(initial?.print_id ?? null);
  const [sizes, setSizes] = useState<Size[]>(() => initialSizes(initial));
  const [colors, setColors] = useState<ColorRow[]>(() => initialColors(initial));
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [specOpen, setSpecOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  if (initialId !== snapshotId) {
    setSnapshotId(initialId);
    setName(initial?.name ?? "");
    setProductType(initial?.product_type ?? "tshirt");
    setSpecId(initial?.spec_id ?? "");
    setPrintId(initial?.print_id ?? null);
    setSizes(initialSizes(initial));
    setColors(initialColors(initial));
    setSubmissionError(null);
  }

  const specs = useSpecs({ page_size: 100 });
  const prints = usePrints({ page_size: 100 });

  const selectedSpec = specs.data?.items.find((s) => s.id === specId) ?? null;
  const selectedPrint = printId ? prints.data?.items.find((p) => p.id === printId) ?? null : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(null);

    if (!name.trim()) {
      setSubmissionError(tValidation("nameRequired"));
      return;
    }
    if (!specId) {
      setSubmissionError(tValidation("specRequired"));
      return;
    }
    const variations = buildVariationItems({ sizes, colors });
    if (variations.length === 0) {
      setSubmissionError(tValidation("variationsRequired"));
      return;
    }

    const payload: ProductCreate = {
      name: name.trim(),
      product_type: productType,
      spec_id: specId,
      print_id: printId,
      variations,
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setSubmissionError(tValidation("duplicatePair"));
        } else {
          setSubmissionError(err.detail);
        }
        onError?.(err);
        return;
      }
      throw err;
    }
  };

  const specOptions = useMemo(() => specs.data?.items ?? [], [specs.data]);
  const printOptions = useMemo(() => prints.data?.items ?? [], [prints.data]);

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-[22px]"
      data-testid="product-form"
    >
      <section>
        <h3 className="mb-3 border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
          {t("form.sections.identity")}
        </h3>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-name" className={LABEL_CLASS}>
              {t("form.labels.name")}
            </label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("form.placeholders.name")}
              autoComplete="off"
              data-testid="product-form-name"
              maxLength={120}
              className="h-9 rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] text-[13px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-type" className={LABEL_CLASS}>
              {t("form.labels.productType")}
            </label>
            <Select
              value={productType}
              onValueChange={(v) => setProductType(v as ProductType)}
            >
              <SelectTrigger id="product-type" data-testid="product-form-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map((pt) => (
                  <SelectItem key={pt} value={pt}>
                    {t(`productTypes.${pt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
          {t("form.sections.recipe")}
        </h3>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>{t("form.labels.spec")}</label>
            <Popover open={specOpen} onOpenChange={setSpecOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={specOpen}
                  data-testid="product-form-spec-trigger"
                  className="h-9 justify-between rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] text-[13px] font-normal text-[color:var(--orion-ink)]"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 truncate">
                    <FileText className="size-3 text-[color:var(--orion-ink-3)]" />
                    {selectedSpec ? (
                      <span className="truncate">
                        <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
                          {selectedSpec.code}
                        </span>{" "}
                        — <span>{selectedSpec.name}</span>
                      </span>
                    ) : (
                      <span className="text-[color:var(--orion-ink-3)]">
                        {t("form.placeholders.spec")}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="size-3.5 text-[color:var(--orion-ink-3)]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("form.placeholders.searchSpec")} />
                  <CommandList>
                    <CommandEmpty>{t("form.noResults")}</CommandEmpty>
                    <CommandGroup>
                      {specOptions.map((opt) => (
                        <CommandItem
                          key={opt.id}
                          value={`${opt.code} ${opt.name}`}
                          onSelect={() => {
                            setSpecId(opt.id);
                            setSpecOpen(false);
                          }}
                          data-testid={`spec-option-${opt.code}`}
                        >
                          <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
                            {opt.code}
                          </span>
                          <span className="ml-2 truncate">{opt.name}</span>
                          {opt.id === specId ? (
                            <Check className="ml-auto size-3.5 text-[color:var(--brand-catalog)]" />
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL_CLASS}>{t("form.labels.print")}</label>
            <Popover open={printOpen} onOpenChange={setPrintOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={printOpen}
                  data-testid="product-form-print-trigger"
                  className="h-9 justify-between rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] text-[13px] font-normal text-[color:var(--orion-ink)]"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 truncate">
                    <Palette className="size-3 text-[color:var(--orion-ink-3)]" />
                    {selectedPrint ? (
                      <span className="truncate">
                        <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
                          {selectedPrint.code}
                        </span>{" "}
                        — <span>{selectedPrint.name}</span>
                      </span>
                    ) : (
                      <span className="text-[color:var(--orion-ink-3)]">
                        {t("form.placeholders.print")}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="size-3.5 text-[color:var(--orion-ink-3)]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("form.placeholders.searchPrint")} />
                  <CommandList>
                    <CommandEmpty>{t("form.noResults")}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          setPrintId(null);
                          setPrintOpen(false);
                        }}
                        data-testid="print-option-none"
                      >
                        <span className="text-[color:var(--orion-ink-3)]">
                          {t("form.printNone")}
                        </span>
                        {printId === null ? (
                          <Check className="ml-auto size-3.5 text-[color:var(--brand-catalog)]" />
                        ) : null}
                      </CommandItem>
                      {printOptions.map((opt) => (
                        <CommandItem
                          key={opt.id}
                          value={`${opt.code} ${opt.name}`}
                          onSelect={() => {
                            setPrintId(opt.id);
                            setPrintOpen(false);
                          }}
                          data-testid={`print-option-${opt.code}`}
                        >
                          <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
                            {opt.code}
                          </span>
                          <span className="ml-2 truncate">{opt.name}</span>
                          {opt.id === printId ? (
                            <Check className="ml-auto size-3.5 text-[color:var(--brand-catalog)]" />
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
          {t("form.sections.variations")}
        </h3>
        <VariationsBuilder
          value={{ sizes, colors }}
          onChange={({ sizes: s, colors: c }) => {
            setSizes(s);
            setColors(c);
          }}
          specCode={selectedSpec?.code ?? null}
          printCode={selectedPrint?.code ?? null}
        />
      </section>

      {submissionError ? (
        <p
          role="alert"
          data-testid="product-form-error"
          className="rounded-[6px] border border-[color:var(--status-err)] bg-[color:color-mix(in_oklab,var(--status-err)_12%,var(--orion-surface))] px-3 py-2 text-[12px] text-[color:var(--status-err)]"
        >
          {submissionError}
        </p>
      ) : null}
    </form>
  );
}

// Re-export for tests
export { initialColors as __initialColors, initialSizes as __initialSizes };
