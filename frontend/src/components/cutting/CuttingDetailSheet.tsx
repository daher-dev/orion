"use client";

import { useState } from "react";
import { Check, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { useUpdateCuttingOrder } from "@/hooks/use-cutting";
import { CUTTING_STATUSES, type CuttingOrder, type CuttingStatus } from "@/lib/schemas/cutting";
import { SIZES } from "@/lib/schemas/product";
import { ApiError } from "@/lib/api-client";
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

export function CuttingDetailSheet({ order, open, onOpenChange }: Props) {
  const t = useTranslations("cutting");
  const update = useUpdateCuttingOrder();

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

  const plannedMap = Object.fromEntries(
    (order?.planned_outputs ?? []).map((o) => [o.size, o.quantity]),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none"
      >
        <SheetHeader
          className="flex-row items-center gap-3 border-b border-[color:var(--orion-line-soft)] p-0"
          style={{ padding: "18px 22px" }}
        >
          <span
            className="grid size-9 place-items-center rounded-[8px] text-[color:var(--orion-ink-2)]"
            style={{ background: "color-mix(in oklab, var(--brand-prod) 14%, var(--orion-surface))" }}
            aria-hidden
          >
            <Scissors size={16} strokeWidth={1.6} />
          </span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("detail.title")}
            </SheetTitle>
            <SheetDescription className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
              {order ? order.id.replace(/-/g, "").slice(0, 8).toUpperCase() : "—"}
            </SheetDescription>
          </div>
          <div className="ml-auto">
            <CuttingStatusPill status={order?.status ?? "pending"} />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto" style={{ padding: "18px 22px" }}>
          {order ? (
            <>
              {/* Product + rolls hero */}
              <div className="mb-4 rounded-[12px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-4">
                <div className="mb-3">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {t("detail.product")}
                  </div>
                  <div className="mt-0.5 font-serif text-[15px] text-[color:var(--orion-ink)]">
                    {order.product.name}
                  </div>
                  {order.product.code ? (
                    <div className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                      {order.product.code}
                    </div>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                      {t("detail.bodyRoll")}
                    </div>
                    <div className="mt-0.5 font-mono text-[12px] text-[color:var(--orion-ink-2)]">
                      {order.body_roll.code}
                    </div>
                  </div>
                  {order.rib_roll ? (
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                        {t("detail.ribRoll")}
                      </div>
                      <div className="mt-0.5 font-mono text-[12px] text-[color:var(--orion-ink-2)]">
                        {order.rib_roll.code}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Status selector */}
              <div className="mb-4">
                <div className={SECTION_CLASS}>{t("detail.status")}</div>
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

              {/* Planned vs. actual per size */}
              <div className={SECTION_CLASS}>{t("detail.plannedOutputs")}</div>
              <div className="mb-4 overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
                <div className="grid grid-cols-4 gap-px bg-[color:var(--orion-line-soft)]">
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

              <div className={SECTION_CLASS}>{t("detail.actualOutputs")}</div>
              <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
                <div className="grid grid-cols-4 gap-px bg-[color:var(--orion-line-soft)]">
                  {SIZES.map((s) => (
                    <div
                      key={s}
                      className="flex flex-col items-center gap-1.5 bg-[color:var(--orion-surface)] px-2 py-3"
                    >
                      <span className="font-mono text-[13px] font-medium text-[color:var(--orion-ink)]">
                        {s.toUpperCase()}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={actualMap[s] ?? 0}
                        onChange={(e) =>
                          setActualMap((prev) => ({
                            ...prev,
                            [s]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className={`${FIELD_INPUT_CLASS} h-auto w-full max-w-[68px] text-center`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <SheetFooter
          className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-0 sm:justify-end"
          style={{ padding: "14px 22px" }}
        >
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
            disabled={update.isPending}
            onClick={() => void handleSave()}
            className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
            style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
          >
            <Check size={13} strokeWidth={2.2} />
            {t("detail.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
