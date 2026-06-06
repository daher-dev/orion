"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Hash, Search, Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHead } from "@/components/page/PageHead";
import { HelpCard } from "@/components/page/HelpCard";
import { useRouter } from "@/i18n/routing";
import { ProductFormSheet } from "@/components/products/ProductFormSheet";
import { ProductsEmptyState } from "@/components/products/ProductsEmptyState";
import { ProductsTable } from "@/components/products/ProductsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanAccess } from "@/hooks/use-permissions";
import { usePrints } from "@/hooks/use-prints";
import { useProducts } from "@/hooks/use-products";
import { useSpecs } from "@/hooks/use-specs";
import { PRODUCT_TYPES, type ProductType } from "@/lib/schemas/product";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function ProductsPage() {
  const t = useTranslations("products");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [productType, setProductType] = useState<"all" | ProductType>("all");
  const [creating, setCreating] = useState(false);
  const canWrite = useCanAccess("products.write");
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useProducts({
    q: debouncedSearch || undefined,
    product_type: productType === "all" ? undefined : productType,
  });

  // Spec + print lookups so the table can render codes instead of UUIDs.
  const specs = useSpecs({ page_size: 100 });
  const prints = usePrints({ page_size: 100 });

  const specCodeById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of specs.data?.items ?? []) out[s.id] = s.code;
    return out;
  }, [specs.data]);

  const printCodeById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const p of prints.data?.items ?? []) out[p.id] = p.code;
    return out;
  }, [prints.data]);

  const printImageById = useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const p of prints.data?.items ?? []) out[p.id] = p.image_url ?? null;
    return out;
  }, [prints.data]);

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const isFiltering = !!debouncedSearch || productType !== "all";
  const showEmpty = !isPending && !isError && total === 0 && !isFiltering;

  return (
    <div data-testid="products-page">
      <PageHead
        subColor="var(--brand-catalog)"
        mark={<Shirt size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              data-testid="products-new-cta"
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{
                borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)",
              }}
            >
              <Shirt className="size-3.5" strokeWidth={1.8} />
              {t("actions.create")}
            </Button>
          ) : null
        }
      />

      <HelpCard
        icon={Shirt}
        tone="var(--brand-catalog)"
        title={t("help.title")}
        steps={[
          { icon: FileText, label: t("help.flow.recipe"), sub: t("help.flow.recipeSub") },
          { icon: Shirt, label: t("help.flow.product"), sub: t("help.flow.productSub"), accent: true },
          { icon: Hash, label: t("help.flow.variations"), sub: t("help.flow.variationsSub") },
        ]}
      >
        {t("help.body")}
      </HelpCard>

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
            <Input
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
              data-testid="products-search"
            />
          </div>
          <Select
            value={productType}
            onValueChange={(v) => setProductType(v as "all" | ProductType)}
          >
            <SelectTrigger size="sm" data-testid="products-type-filter" className="min-w-[140px]">
              <SelectValue placeholder={t("filters.productType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.all")}</SelectItem>
              {PRODUCT_TYPES.map((pt) => (
                <SelectItem key={pt} value={pt}>
                  {t(`productTypes.${pt}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data ? (
            <span className="ml-auto text-[12px] text-[color:var(--orion-ink-3)] tabular-nums">
              {total} {t("filters.itemCount")}
            </span>
          ) : null}
        </div>

        {isPending ? (
          <div className="space-y-2 p-4" data-testid="products-list-loading">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div
            className="px-6 py-10 text-center text-[13px] text-[color:var(--status-err)]"
            data-testid="products-list-error"
          >
            {t("list.loadError")}
          </div>
        ) : showEmpty ? (
          <ProductsEmptyState onCreate={canWrite ? () => setCreating(true) : undefined} />
        ) : (
          <ProductsTable
            rows={rows}
            specCodeById={specCodeById}
            printCodeById={printCodeById}
            printImageById={printImageById}
            onEdit={(p) => router.push(`/products/${p.id}`)}
          />
        )}
      </div>

      <ProductFormSheet open={creating} onOpenChange={setCreating} />
    </div>
  );
}
