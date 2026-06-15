"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MinusCircle, PlusCircle, Search, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHead } from "@/components/page/PageHead";
import { Link } from "@/i18n/routing";
import { ApiError } from "@/lib/api-client";
import { InventoryKpis } from "@/components/inventory/InventoryKpis";
import { SideGlyph } from "@/components/inventory/SideGlyph";
import { TransferChip } from "@/components/inventory/TransferChip";
import { UnitLedger } from "@/components/inventory/UnitLedger";
import {
  UnitMoveSheet,
  type RecentMove,
  type UnitMoveType,
} from "@/components/inventory/UnitMoveSheet";
import { PrintedTransfersTable } from "@/components/printed-transfers/PrintedTransfersTable";
import {
  useCreatePrintedMovement,
  usePrintedTransferLevels,
  usePrintedTransferMovements,
} from "@/hooks/use-printed-transfers";
import { useCanAccess } from "@/hooks/use-permissions";
import type { PrintedMovementRead, PrintedTransferLevelRead } from "@/lib/schemas/printed-transfer";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Move-type tiles for the printed-transfers sheet — port of `PRINTED_MOVES`:
 * Ajuste (+)/Ajuste (−) → `adjustment`; Refugo is a scrap exit (failed print).
 */
const PRINTED_MOVE_TYPES: readonly UnitMoveType[] = [
  { id: "in-ajuste", dir: "+", kind: "adjustment", i18nKey: "entryAdjustment", icon: PlusCircle },
  { id: "out-ajuste", dir: "-", kind: "adjustment", i18nKey: "exitAdjustment", icon: MinusCircle },
  { id: "out-refugo", dir: "-", kind: "exit", i18nKey: "scrap", icon: AlertTriangle },
] as const;

export default function PrintedTransfersPage() {
  const t = useTranslations("printedTransfers");
  const tSides = useTranslations("printedTransfers.sides");
  const [tab, setTab] = useState<"current" | "movements">("current");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [moveItem, setMoveItem] = useState<PrintedTransferLevelRead | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const canWrite = useCanAccess("printed_stock.write");
  const debouncedSearch = useDebouncedValue(search, 200);

  const levels = usePrintedTransferLevels({
    q: debouncedSearch || undefined,
    low_stock_only: lowOnly || undefined,
  });
  const movements = usePrintedTransferMovements(tab === "movements" ? { page_size: 50 } : {});
  const recentForItem = usePrintedTransferMovements(
    moveOpen && moveItem ? { printed_transfer_id: moveItem.printed_transfer_id, page_size: 10 } : {},
  );
  const createMovement = useCreatePrintedMovement();

  const rows = levels.data?.items ?? [];
  const total = rows.reduce((sum, r) => sum + r.on_hand, 0);
  const alerting = rows.filter((r) => r.low_stock || r.on_hand <= 0).length;

  function openMove(item: PrintedTransferLevelRead) {
    setServerError(null);
    setMoveItem(item);
    setMoveOpen(true);
  }

  async function handleApply(moveType: UnitMoveType, quantity: number) {
    if (!moveItem) return;
    setServerError(null);
    try {
      await createMovement.mutateAsync({
        printed_transfer_id: moveItem.printed_transfer_id,
        kind: moveType.kind,
        quantity,
        notes: moveType.note ?? null,
      });
      toast.success(t("toasts.movementCreated"));
      setMoveOpen(false);
      setMoveItem(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const match = /(\d+)/.exec(err.detail);
        const available = match ? Number(match[1]) : moveItem.on_hand;
        setServerError(t("moveSheet.validation.insufficient", { available }));
        return;
      }
      toast.error(t("toasts.error"));
    }
  }

  const recentMoves: RecentMove[] = (recentForItem.data?.items ?? []).map((m: PrintedMovementRead) => ({
    id: m.id,
    kind: m.kind,
    quantity: m.quantity,
    created_at: m.created_at,
    reasonLabel: t(`moveSheet.ledgerKinds.${m.kind}`),
  }));

  const hero = moveItem ? (
    <div className="flex items-center gap-3 rounded-[12px] bg-[color:var(--orion-surface-2)] p-[18px]">
      <TransferChip imageUrl={moveItem.design.image_url} size={56} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-serif text-[17px] text-[color:var(--orion-ink)]">{moveItem.design.name}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[12px] text-[color:var(--orion-ink-2)]">
          <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">{moveItem.design.code}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-2 py-[2px] text-[11px]">
            <SideGlyph side={moveItem.side} size={13} />
            {tSides(moveItem.side)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div
          className="font-serif text-[28px] leading-none tabular-nums"
          style={{ color: moveItem.low_stock ? "var(--status-warn)" : "var(--orion-ink)" }}
        >
          {moveItem.on_hand}
        </div>
        <div className="mt-1 text-[10.5px] text-[color:var(--orion-ink-3)]">{t("moveSheet.onHandLabel")}</div>
      </div>
    </div>
  ) : null;

  const ledgerLabelFor = (row: PrintedMovementRead) =>
    row.design ? (
      <span className="inline-flex items-center gap-2">
        <SideGlyph side={row.side} size={14} />
        <span className="font-mono text-[12px] text-[color:var(--orion-ink)]">{row.design.code}</span>
        <span className="text-[12px] text-[color:var(--orion-ink-3)]">{tSides(row.side)}</span>
      </span>
    ) : (
      <span className="text-[color:var(--orion-ink-3)]">—</span>
    );

  return (
    <div>
      <PageHead
        subColor="var(--brand-inv)"
        mark={<Stamp size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          <Button
            type="button"
            asChild
            variant="outline"
            className="h-auto gap-[7px] rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
          >
            <Link href="/printed-transfers/movements">{t("actions.viewFullLedger")}</Link>
          </Button>
        }
      />

      <InventoryKpis
        items={[
          { label: t("kpis.total"), value: total, unit: t("kpis.totalUnit") },
          {
            label: t("kpis.alerting"),
            value: alerting,
            tone: alerting ? "var(--status-warn)" : "var(--orion-ink)",
            hint: t("kpis.alertingHint"),
          },
        ]}
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
          <div className="inline-flex rounded-[7px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] p-0.5">
            {(["current", "movements"] as const).map((value) => (
              <button
                key={value}
                type="button"
                data-testid={`printed-transfers-tab-${value}`}
                onClick={() => setTab(value)}
                className="rounded-[5px] px-3 py-[5px] text-[12.5px] font-medium transition-colors"
                style={{
                  background: tab === value ? "var(--orion-surface)" : "transparent",
                  color: tab === value ? "var(--orion-ink)" : "var(--orion-ink-3)",
                  boxShadow: tab === value ? "0 1px 2px rgba(31,27,21,0.08)" : "none",
                }}
              >
                {t(`tabs.${value}`)}
              </button>
            ))}
          </div>
          <div className="flex min-w-[220px] items-center gap-1.5 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-2.5 py-[5px] text-[12.5px] text-[color:var(--orion-ink-2)]">
            <Search className="size-3.5 text-[color:var(--orion-ink-3)]" />
            <Input
              data-testid="printed-transfers-search"
              placeholder={t("filters.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] focus-visible:ring-0"
            />
          </div>
          {tab === "current" ? (
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[12px] text-[color:var(--orion-ink-2)]">
              <input
                type="checkbox"
                data-testid="printed-transfers-low-toggle"
                checked={lowOnly}
                onChange={(e) => setLowOnly(e.target.checked)}
              />
              {t("filters.lowStockOnly")}
            </label>
          ) : null}
        </div>

        {tab === "current" ? (
          levels.isPending ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          ) : levels.isError ? (
            <div className="px-6 py-12 text-center text-[12.5px] text-[color:var(--status-err)]">{t("toasts.error")}</div>
          ) : rows.length === 0 ? (
            <div data-testid="printed-transfers-empty" className="px-6 py-14 text-center text-[color:var(--orion-ink-3)]">
              <div className="mx-auto mb-3 grid size-14 place-items-center rounded-[14px] bg-[color:var(--orion-surface-2)]">
                <Stamp size={24} strokeWidth={1.6} />
              </div>
              <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">{t("list.empty.title")}</h3>
              <p className="mx-auto max-w-[360px] text-[13px] leading-[1.5]">{t("list.empty.body")}</p>
            </div>
          ) : (
            <PrintedTransfersTable data={rows} onRowClick={canWrite ? openMove : () => {}} />
          )
        ) : movements.isPending ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : (
          <UnitLedger
            rows={movements.data?.items ?? []}
            i18nNamespace="printedTransfers"
            testId="printed-transfers-ledger"
            labelFor={ledgerLabelFor}
          />
        )}
      </div>

      <UnitMoveSheet
        open={moveOpen}
        onOpenChange={(open) => {
          setMoveOpen(open);
          if (!open) {
            setMoveItem(null);
            setServerError(null);
          }
        }}
        item={
          moveItem
            ? { label: moveItem.design.name, on_hand: moveItem.on_hand, min_stock: moveItem.min_stock }
            : null
        }
        hero={hero}
        moveTypes={PRINTED_MOVE_TYPES}
        moves={recentMoves}
        i18nNamespace="printedTransfers"
        testIdPrefix="printed-transfers"
        isPending={createMovement.isPending}
        serverError={serverError}
        onApply={handleApply}
      />
    </div>
  );
}
