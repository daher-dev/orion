"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer, Radar, RefreshCw, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { CutSuggestionRow } from "@/components/planning/CutSuggestionRow";
import { PlanningActionBar } from "@/components/planning/PlanningActionBar";
import { PlanningEmptyState } from "@/components/planning/PlanningEmptyState";
import { PrintSuggestionRow } from "@/components/planning/PrintSuggestionRow";
import { SuggestColumn } from "@/components/planning/SuggestColumn";
import { useCreateCuttingOrders, useCreatePrintOrders, usePlanningSuggestions } from "@/hooks/use-planning";
import { useCanAccess } from "@/hooks/use-permissions";
import { useRouter } from "@/i18n/routing";
import type { PlanningCorte, PlanningImpressao } from "@/lib/schemas/planning";

type FilterValue = "all" | "demanda" | "estoque";

const SECONDARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

/** A suggestion matches a filter when its demand/stock split is non-zero. */
function matchesFilter(s: { demand: number; stock: number }, filter: FilterValue): boolean {
  if (filter === "all") return true;
  if (filter === "demanda") return s.demand > 0;
  return s.stock > 0;
}

export default function PlanningPage() {
  const t = useTranslations("planning");
  const canRead = useCanAccess("planning.read");
  const canWrite = useCanAccess("planning.write");
  const router = useRouter();

  const { data, isPending, isError, refetch, isFetching } = usePlanningSuggestions();
  const createCutting = useCreateCuttingOrders();
  const createPrint = useCreatePrintOrders();

  const [filter, setFilter] = useState<FilterValue>("all");
  const [pickedCortes, setPickedCortes] = useState<Set<string>>(new Set());
  const [pickedImpr, setPickedImpr] = useState<Set<string>>(new Set());
  const [createdCodes, setCreatedCodes] = useState<string[] | null>(null);

  const allCortes = useMemo<PlanningCorte[]>(() => data?.cortes ?? [], [data]);
  const allImpr = useMemo<PlanningImpressao[]>(() => data?.impressoes ?? [], [data]);

  // Initialise the selection to every key whenever the underlying key sets
  // change (prototype: re-seed on cortes/impressões length change). Keying on
  // the joined key strings re-seeds on any membership change, not just length.
  const corteKeysSig = allCortes.map((c) => c.key).join("|");
  const imprKeysSig = allImpr.map((i) => i.key).join("|");
  useEffect(() => {
    setPickedCortes(new Set(allCortes.map((c) => c.key)));
    setPickedImpr(new Set(allImpr.map((i) => i.key)));
    setCreatedCodes(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corteKeysSig, imprKeysSig]);

  const toggle = (setter: typeof setPickedCortes) => (key: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleCorte = toggle(setPickedCortes);
  const toggleImpr = toggle(setPickedImpr);

  const filteredCortes = allCortes.filter((c) => matchesFilter(c, filter));
  const filteredImpr = allImpr.filter((i) => matchesFilter(i, filter));

  const totals = data?.totals;
  const allCount = allCortes.length + allImpr.length;

  // Selection is scoped to the visible (filtered) rows — only those can be
  // created from the current view, matching the prototype.
  const selectedCorteKeys = filteredCortes.filter((c) => pickedCortes.has(c.key)).map((c) => c.key);
  const selectedImprKeys = filteredImpr.filter((i) => pickedImpr.has(i.key)).map((i) => i.key);
  const selectedTotal = selectedCorteKeys.length + selectedImprKeys.length;

  const cortesTotal = filteredCortes.reduce((acc, c) => acc + c.total, 0);
  const imprTotal = filteredImpr.reduce((acc, i) => acc + i.total, 0);

  const isCreating = createCutting.isPending || createPrint.isPending;

  async function handleCreate() {
    if (selectedTotal === 0) return;
    try {
      const [cutRes, printRes] = await Promise.all([
        selectedCorteKeys.length > 0
          ? createCutting.mutateAsync({ keys: selectedCorteKeys })
          : Promise.resolve({ created: [], skipped: [], created_count: 0 }),
        selectedImprKeys.length > 0
          ? createPrint.mutateAsync({ keys: selectedImprKeys })
          : Promise.resolve({ created: [], skipped: [], created_count: 0 }),
      ]);

      const createdCount = cutRes.created_count + printRes.created_count;
      const skippedCount = cutRes.skipped.length + printRes.skipped.length;
      const codes = [...cutRes.created.map((c) => c.code), ...printRes.created.map((p) => p.code)];

      if (skippedCount > 0) {
        toast.warning(t("toasts.partial", { n: createdCount, skipped: skippedCount }));
      } else {
        toast.success(t("toasts.created", { n: createdCount }));
      }
      setCreatedCodes(codes);
    } catch {
      toast.error(t("toasts.error"));
    }
  }

  if (!canRead) {
    return <p className="text-[13px] text-[color:var(--orion-ink-3)]">{t("fallback.forbidden")}</p>;
  }

  const empty = !isPending && !isError && filteredCortes.length === 0 && filteredImpr.length === 0;

  return (
    <div>
      <PageHead
        subColor="var(--brand-prod)"
        mark={<Radar size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          <Button
            type="button"
            data-testid="planning-recalc"
            className={SECONDARY_BUTTON_CLASS}
            disabled={isFetching}
            onClick={() => {
              setCreatedCodes(null);
              void refetch();
            }}
          >
            <RefreshCw size={14} strokeWidth={1.8} className={isFetching ? "animate-spin" : undefined} />
            {t("actions.recalc")}
          </Button>
        }
      />

      {/* Filter segmented control + summary line. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          data-testid="planning-filter"
          className="inline-flex rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] p-0.5"
        >
          {(
            [
              { value: "all" as const, label: t("filters.all"), count: allCount },
              { value: "demanda" as const, label: t("filters.demand"), count: totals?.demandDriven ?? 0 },
              { value: "estoque" as const, label: t("filters.stock"), count: totals?.stockDriven ?? 0 },
            ]
          ).map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`planning-filter-${opt.value}`}
                onClick={() => setFilter(opt.value)}
                className="rounded-[6px] px-3 py-[5px] text-[12.5px] font-medium transition-colors"
                style={{
                  background: active ? "var(--orion-surface)" : "transparent",
                  color: active ? "var(--orion-ink)" : "var(--orion-ink-3)",
                  boxShadow: active ? "0 1px 2px rgba(31,27,21,0.08)" : "none",
                }}
              >
                {opt.label} <span className="tabular-nums opacity-70">({opt.count})</span>
              </button>
            );
          })}
        </div>
        {totals ? (
          <span className="ml-auto text-[12.5px] text-[color:var(--orion-ink-3)]">
            <b className="font-serif text-[15px] text-[color:var(--orion-ink-2)] tabular-nums">{totals.toCut}</b>{" "}
            {t("summary.toCut")} ·{" "}
            <b className="font-serif text-[15px] text-[color:var(--orion-ink-2)] tabular-nums">{totals.toPrint}</b>{" "}
            {t("summary.toPrint")}
          </span>
        ) : null}
      </div>

      {isPending ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-[280px] rounded-[14px]" />
          <Skeleton className="h-[280px] rounded-[14px]" />
        </div>
      ) : isError ? (
        <p className="px-6 py-12 text-center text-[13px] text-[color:var(--status-err)]">{t("toasts.error")}</p>
      ) : empty ? (
        <PlanningEmptyState isAllFilter={filter === "all"} />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <SuggestColumn
              icon={Scissors}
              title={t("columns.cortes")}
              count={filteredCortes.length}
              total={cortesTotal}
              unit={t("units.pieces")}
              emptyLabel={t("empty.bodyFiltered")}
              testId="planning-cortes-list"
            >
              {filteredCortes.map((corte) => (
                <CutSuggestionRow
                  key={corte.key}
                  corte={corte}
                  checked={pickedCortes.has(corte.key)}
                  disabled={!canWrite}
                  onToggle={toggleCorte}
                />
              ))}
            </SuggestColumn>

            <SuggestColumn
              icon={Printer}
              title={t("columns.impressoes")}
              count={filteredImpr.length}
              total={imprTotal}
              unit={t("units.prints")}
              emptyLabel={t("empty.bodyFiltered")}
              testId="planning-impressoes-list"
            >
              {filteredImpr.map((impressao) => (
                <PrintSuggestionRow
                  key={impressao.key}
                  impressao={impressao}
                  checked={pickedImpr.has(impressao.key)}
                  disabled={!canWrite}
                  onToggle={toggleImpr}
                />
              ))}
            </SuggestColumn>
          </div>

          {canWrite ? (
            <PlanningActionBar
              cortesSelected={selectedCorteKeys.length}
              impressoesSelected={selectedImprKeys.length}
              total={selectedTotal}
              isPending={isCreating}
              createdCodes={createdCodes}
              onCreate={handleCreate}
              onViewCutting={() => router.push("/cutting")}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
