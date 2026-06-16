"use client";

import { useState } from "react";
import { Check, Layers, Rows3, Scissors, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { useDeleteCuttingOrder, useUpdateCuttingOrder } from "@/hooks/use-cutting";
import {
  CUTTING_STATUSES,
  sumOutputs,
  type CuttingOrder,
  type CuttingStatus,
} from "@/lib/schemas/cutting";
import { SIZES } from "@/lib/schemas/product";
import { ApiError } from "@/lib/api-client";
import { CuttingCostSection } from "./CuttingCostSection";
import { CuttingStatusPill } from "./CuttingStatusPill";

type Props = {
  order: CuttingOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-prod)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-prod)_16%,transparent)] focus-visible:outline-none";

const SECTION_CLASS =
  "mb-[10px] mt-[18px] border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";

const SHEET_CLASS =
  "flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

// Footer delete button — matches Cancel's .btn footprint, painted in
// --status-err so it reads destructive. Anchors the left of the footer.
const DELETE_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--status-err)] shadow-none hover:bg-[color:color-mix(in_oklab,var(--status-err)_8%,var(--orion-surface))]";

export function CuttingDetailSheet({ order, open, onOpenChange }: Props) {
  const t = useTranslations("cutting");
  const update = useUpdateCuttingOrder();
  const remove = useDeleteCuttingOrder();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [status, setStatus] = useState<CuttingStatus>(order?.status ?? "pending");
  const [actualMap, setActualMap] = useState<Record<string, number>>(
    Object.fromEntries((order?.actual_outputs ?? []).map((o) => [o.size, o.quantity])),
  );

  // Sync local state when the order changes (different row opened).
  const orderId = order?.id;
  const [lastOrderId, setLastOrderId] = useState<string | undefined>(orderId);
  if (orderId !== lastOrderId) {
    setStatus(order?.status ?? "pending");
    setActualMap(
      Object.fromEntries((order?.actual_outputs ?? []).map((o) => [o.size, o.quantity])),
    );
    setLastOrderId(orderId);
  }

  async function handleSave() {
    if (!order) return;
    try {
      await update.mutateAsync({
        id: order.id,
        payload: {
          status,
          actual_outputs: SIZES.map((s) => ({ size: s, quantity: actualMap[s] ?? 0 })),
        },
      });
      toast.success(t("form.toasts.updated"));
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : (err instanceof Error ? err.message : "");
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  async function handleDelete() {
    if (!order) return;
    try {
      await remove.mutateAsync(order.id);
      toast.success(t("form.toasts.deleted"));
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : (err instanceof Error ? err.message : "");
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  const plannedMap = Object.fromEntries(
    (order?.planned_outputs ?? []).map((o) => [o.size, o.quantity]),
  );

  const totalPlanned = sumOutputs(order?.planned_outputs);
  const totalActual = SIZES.reduce((acc, s) => acc + (actualMap[s] ?? 0), 0);
  const progressPct =
    totalPlanned > 0 ? Math.min(100, Math.round((totalActual / totalPlanned) * 100)) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CLASS}>
        <SheetHeader
          className="flex-row items-center gap-3 border-b border-[color:var(--orion-line-soft)] p-0"
          style={{ padding: "18px 22px" }}
        >
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("detail.title")}
            </SheetTitle>
            <SheetDescription className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
              {order ? order.id.replace(/-/g, "").slice(0, 8).toUpperCase() : "—"}
            </SheetDescription>
          </div>
          {order ? <CuttingStatusPill status={order.status} /> : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto" style={{ padding: "18px 22px" }}>
          {order ? (
            <>
              {/* Product hero — direct port of the design's product header
                  block (scissors mark, name, roll line). */}
              <div
                className="mb-[18px] flex items-center gap-3.5 rounded-[12px]"
                style={{ background: "var(--orion-surface-2)", padding: 18 }}
              >
                <span
                  aria-hidden
                  className="grid place-items-center"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background:
                      "color-mix(in oklab, var(--brand-prod) 14%, var(--orion-surface))",
                    color: "var(--brand-prod)",
                  }}
                >
                  <Scissors size={22} strokeWidth={1.6} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-serif text-[17px] text-[color:var(--orion-ink)]">
                      {order.spec.name}
                    </span>
                    <span className="shrink-0 text-[12px] text-[color:var(--orion-ink-3)]">
                      {order.color}
                    </span>
                  </div>
                  <div
                    className="text-[color:var(--orion-ink-3)]"
                    style={{ fontSize: 12, marginTop: 4 }}
                  >
                    <span className="font-mono">{order.spec.code}</span>
                    {" · "}
                    {t("detail.bodyRollLabel")}{" "}
                    <span className="font-mono">{order.body_roll.code}</span>
                    {totalPlanned > 0
                      ? ` · ${totalPlanned} ${t("kanban.pieces")}`
                      : ""}
                  </div>
                </div>
              </div>

              {/* Progress block — direct port of design's `Progresso`. */}
              <div className="mb-[6px] text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("detail.progress")}
              </div>
              <div
                className="mb-[18px] rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)]"
                style={{ padding: 14 }}
              >
                <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
                  <span
                    className="font-serif text-[color:var(--orion-ink)]"
                    style={{ fontSize: 24, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
                  >
                    {totalActual}
                    <span className="text-[color:var(--orion-ink-3)]" style={{ fontSize: 16 }}>
                      {" / "}
                      {totalPlanned}
                    </span>
                  </span>
                  <span
                    className="text-[color:var(--orion-ink-3)]"
                    style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}
                  >
                    {progressPct}% {t("detail.complete")}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--orion-line-soft)",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      background: "var(--brand-prod)",
                      borderRadius: 999,
                      transition: "width .25s ease",
                    }}
                  />
                </div>
              </div>

              {/* Rolls section — mono labels under brand-tinted chips */}
              <div className={SECTION_CLASS} style={{ marginTop: 0 }}>
                {t("form.sections.rolls")}
              </div>
              <div className="mb-[18px] grid grid-cols-2 gap-3">
                <div className="rounded-[8px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    <Layers size={11} strokeWidth={1.6} />
                    {t("detail.bodyRoll")}
                  </div>
                  <div className="mt-1 font-mono text-[12.5px] text-[color:var(--orion-ink)]">
                    {order.body_roll.code}
                  </div>
                </div>
                {order.rib_roll ? (
                  <div className="rounded-[8px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                      <Rows3 size={11} strokeWidth={1.6} />
                      {t("detail.ribRoll")}
                    </div>
                    <div className="mt-1 font-mono text-[12.5px] text-[color:var(--orion-ink)]">
                      {order.rib_roll.code}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Status selector */}
              <div className={SECTION_CLASS} style={{ marginTop: 0 }}>
                {t("detail.status")}
              </div>
              <div className="mb-[6px]">
                <Select value={status} onValueChange={(v) => setStatus(v as CuttingStatus)}>
                  <SelectTrigger className={FIELD_INPUT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUTTING_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Planned read-only grid */}
              <div className={SECTION_CLASS}>{t("detail.plannedOutputs")}</div>
              <div className="mb-4 overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
                <div className="grid grid-cols-5 gap-px bg-[color:var(--orion-line-soft)]">
                  {SIZES.map((s) => (
                    <div
                      key={s}
                      className="flex flex-col items-center gap-0.5 bg-[color:var(--orion-surface)] px-2 py-2.5"
                    >
                      <span className="font-mono text-[12px] font-medium text-[color:var(--orion-ink-3)]">
                        {s.toUpperCase()}
                      </span>
                      <span
                        className="font-serif text-[18px] text-[color:var(--orion-ink)]"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {plannedMap[s] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actual editable grid with per-size mini progress */}
              <div className={SECTION_CLASS}>{t("detail.actualOutputs")}</div>
              <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
                <div className="grid grid-cols-5 gap-px bg-[color:var(--orion-line-soft)]">
                  {SIZES.map((s) => {
                    const planned = plannedMap[s] ?? 0;
                    const actual = actualMap[s] ?? 0;
                    const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
                    const reached = planned > 0 && actual === planned;
                    return (
                      <div
                        key={s}
                        className="flex flex-col items-center gap-1.5 bg-[color:var(--orion-surface)] px-2 py-3"
                      >
                        <span className="font-mono text-[13px] font-medium text-[color:var(--orion-ink)]">
                          {s.toUpperCase()}
                        </span>
                        <NumberInput
                          tone="prod"
                          step={1}
                          min={0}
                          decimals={0}
                          align="center"
                          aria-label={`${s.toUpperCase()} ${t("detail.actualOutputs")}`}
                          value={actual}
                          onChange={(next) =>
                            setActualMap((prev) => ({
                              ...prev,
                              [s]: next === "" ? 0 : Math.max(0, Number(next) || 0),
                            }))
                          }
                        />
                        {/* Mini per-size progress bar mirrors the design row's
                            inline progress. */}
                        <div
                          aria-hidden
                          style={{
                            width: "100%",
                            maxWidth: 70,
                            height: 3,
                            background: "var(--orion-line-soft)",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: reached ? "var(--status-ok)" : "var(--brand-prod)",
                              transition: "width .25s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Frozen per-run production cost — only renders when the order
                  is done and the cost row has been computed. */}
              <CuttingCostSection order={order} />
            </>
          ) : null}
        </div>

        <SheetFooter
          className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-0 sm:justify-between"
          style={{ padding: "14px 22px" }}
        >
          {order ? (
            <Button
              type="button"
              variant="ghost"
              className={DELETE_BUTTON_CLASS}
              onClick={() => setConfirmDelete(true)}
              disabled={update.isPending || remove.isPending}
            >
              <Trash2 size={13} strokeWidth={1.8} />
              {t("actions.delete")}
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
            >
              {t("detail.close")}
            </Button>
            <Button
              type="button"
              disabled={update.isPending || remove.isPending}
              onClick={() => void handleSave()}
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
            >
              <Check size={13} strokeWidth={2.2} />
              {t("detail.save")}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("actions.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
