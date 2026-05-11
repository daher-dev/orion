"use client";

import { useEffect, useState } from "react";
import { ArrowDownUp, Boxes, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHead } from "@/components/page/PageHead";
import { Link } from "@/i18n/routing";
import { LowStockToggle } from "@/components/stock/LowStockToggle";
import { StockLevelsTable } from "@/components/stock/StockLevelsTable";
import { StockEmptyState } from "@/components/stock/StockEmptyState";
import { MovementsDrawer } from "@/components/stock/MovementsDrawer";
import { StockAdjustDialog } from "@/components/stock/StockAdjustDialog";
import { useStockLevels } from "@/hooks/use-stock";
import { useCanAccess } from "@/hooks/use-permissions";
import type { VariationStockRead } from "@/lib/schemas/stock";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const THRESHOLD = 5;

export default function StockPage() {
  const t = useTranslations("stock");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [drawerVariation, setDrawerVariation] = useState<VariationStockRead | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustVariation, setAdjustVariation] = useState<VariationStockRead | null>(null);
  const canWrite = useCanAccess("stock.write");
  const debouncedSearch = useDebouncedValue(search, 200);

  const { data, isPending, isError } = useStockLevels({
    q: debouncedSearch || undefined,
    low_stock_only: lowOnly || undefined,
    threshold: THRESHOLD,
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const noFilters = !debouncedSearch && !lowOnly;
  const showEmpty = !isPending && !isError && total === 0 && noFilters;

  function openAdjustFor(variation: VariationStockRead | null) {
    setAdjustVariation(variation);
    setAdjustOpen(true);
  }

  return (
    <div>
      <PageHead
        subColor="var(--brand-inv)"
        mark={<Boxes size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              asChild
              className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
            >
              <Link href="/stock/movements">{t("actions.viewFullLedger")}</Link>
            </Button>
            {canWrite ? (
              <Button
                type="button"
                data-testid="stock-page-cta"
                onClick={() => openAdjustFor(rows[0] ?? null)}
                disabled={rows.length === 0}
                className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)",
                }}
              >
                <ArrowDownUp size={14} strokeWidth={2.2} />
                {t("actions.confirmAdjust")}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
            <Input
              data-testid="stock-search"
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
            />
          </div>
          <LowStockToggle checked={lowOnly} onChange={setLowOnly} />
        </div>

        {isPending ? (
          <div className="p-6">
            <div className="space-y-2">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          </div>
        ) : showEmpty ? (
          <StockEmptyState onCreate={canWrite ? () => openAdjustFor(null) : undefined} />
        ) : (
          <StockLevelsTable
            data={rows}
            threshold={THRESHOLD}
            onRowClick={(row) => setDrawerVariation(row)}
          />
        )}
      </div>

      <MovementsDrawer
        variation={drawerVariation}
        open={drawerVariation !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerVariation(null);
        }}
        onAdjust={canWrite ? (v) => openAdjustFor(v) : undefined}
      />

      <StockAdjustDialog
        open={adjustOpen}
        onOpenChange={(open) => {
          setAdjustOpen(open);
          if (!open) setAdjustVariation(null);
        }}
        variation={adjustVariation ?? drawerVariation}
      />
    </div>
  );
}
