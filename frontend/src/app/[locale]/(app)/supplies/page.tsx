"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PageHead } from "@/components/page/PageHead";
import { SuppliesTable } from "@/components/supplies/SuppliesTable";
import { SuppliesEmptyState } from "@/components/supplies/SuppliesEmptyState";
import { SupplyFormSheet } from "@/components/supplies/SupplyFormSheet";
import { SupplyMovementsTable } from "@/components/supplies/SupplyMovementsTable";
import { SupplyAdjustDialog } from "@/components/supplies/SupplyAdjustDialog";
import { useSupply, useSupplyLevels, useSupplyMovements } from "@/hooks/use-supplies";
import { useCanAccess } from "@/hooks/use-permissions";
import type { SupplyLevelRead } from "@/lib/schemas/supply";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

type Tab = "levels" | "movements";

/** Segmented control matching `.seg` from the design system. */
function Seg({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  return (
    <div
      className="inline-flex gap-[2px] rounded-[8px] border p-[2px]"
      style={{ background: "var(--orion-bg)", borderColor: "var(--orion-line)" }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            data-testid={`supplies-tab-${opt.value}`}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="cursor-pointer rounded-[6px] border-0 bg-transparent px-3 py-[6px] font-[inherit] text-[12.5px] transition-colors"
            style={{
              background: active ? "var(--orion-surface)" : "transparent",
              color: active ? "var(--orion-ink)" : "var(--orion-ink-3)",
              fontWeight: active ? 500 : 400,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : undefined,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SuppliesPage() {
  const t = useTranslations("supplies");
  const [tab, setTab] = useState<Tab>("levels");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<SupplyLevelRead | null>(null);

  const canWrite = useCanAccess("supplies.write");
  const debouncedSearch = useDebouncedValue(search, 200);

  const levelsQuery = useSupplyLevels({
    q: debouncedSearch || undefined,
    low_stock_only: lowStockOnly || undefined,
  });
  const movementsQuery = useSupplyMovements();
  const { data: editing } = useSupply(editingId);

  const levelRows = levelsQuery.data?.items ?? [];
  const total = levelsQuery.data?.total ?? 0;
  const noFilters = !debouncedSearch && !lowStockOnly;
  const showEmpty = !levelsQuery.isPending && !levelsQuery.isError && total === 0 && noFilters;

  const tabOptions = [
    { value: "levels", label: t("tabs.levels") },
    { value: "movements", label: t("tabs.movements") },
  ];

  return (
    <div>
      <PageHead
        subColor="var(--brand-inv)"
        mark={<FlaskConical size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          canWrite ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAdjustTarget(null);
                  setAdjusting(true);
                }}
                className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
              >
                <Plus className="size-3.5" strokeWidth={1.8} />
                {t("actions.recordMovement")}
              </Button>
              <Button
                type="button"
                onClick={() => setCreating(true)}
                className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
                style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
              >
                <FlaskConical className="size-3.5" strokeWidth={1.8} />
                {t("list.empty.cta")}
              </Button>
            </div>
          ) : null
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <Seg value={tab} options={tabOptions} onChange={(v) => setTab(v as Tab)} />
          {tab === "levels" ? (
            <>
              <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
                <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
                <Input
                  placeholder={t("filters.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
                />
              </div>
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-[12.5px] text-[color:var(--orion-ink-2)]">
                <Switch
                  checked={lowStockOnly}
                  onCheckedChange={setLowStockOnly}
                  data-testid="supplies-low-stock-toggle"
                />
                {t("filters.lowStockOnly")}
              </label>
            </>
          ) : null}
        </div>

        {tab === "levels" ? (
          levelsQuery.isPending ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : showEmpty ? (
            <SuppliesEmptyState onCreate={canWrite ? () => setCreating(true) : undefined} />
          ) : (
            <SuppliesTable
              data={levelRows}
              onRowClick={(level) => {
                if (canWrite) {
                  setAdjustTarget(level);
                  setAdjusting(true);
                } else {
                  setEditingId(level.supply_id);
                }
              }}
            />
          )
        ) : movementsQuery.isPending ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (movementsQuery.data?.items.length ?? 0) === 0 ? (
          <p className="px-6 py-10 text-center text-[13px] text-[color:var(--orion-ink-3)]">
            {t("movements.empty")}
          </p>
        ) : (
          <SupplyMovementsTable data={movementsQuery.data?.items ?? []} />
        )}
      </div>

      <SupplyFormSheet open={creating} onOpenChange={setCreating} />
      <SupplyFormSheet
        key={editingId ?? "none"}
        open={editingId !== null}
        onOpenChange={(o) => {
          if (!o) setEditingId(null);
        }}
        initial={editing ?? undefined}
      />
      <SupplyAdjustDialog
        key={adjustTarget?.supply_id ?? "any"}
        open={adjusting}
        onOpenChange={(o) => {
          setAdjusting(o);
          if (!o) setAdjustTarget(null);
        }}
        supply={adjustTarget}
      />
    </div>
  );
}
