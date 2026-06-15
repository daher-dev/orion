"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, Printer, Scroll, Stamp } from "lucide-react";
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
import { NumberInput } from "@/components/ui/number-input";
import { TransferChip } from "@/components/inventory/TransferChip";
import { ApiError } from "@/lib/api-client";
import { usePrints } from "@/hooks/use-prints";
import { usePaperRolls } from "@/hooks/use-paper-rolls";
import {
  useCompletePrintOrder,
  useCreatePrintOrder,
  useUpdatePrintOrder,
} from "@/hooks/use-print-orders";
import type { Print } from "@/lib/schemas/print";
import type { PrintOrder } from "@/lib/schemas/print-order";
import { paperRollCode, type PaperType } from "@/lib/schemas/paper-roll";
import { PrintOrderStatusPill } from "./PrintOrderStatusPill";
import { SideGrid } from "./SideGrid";
import {
  emptyGrade,
  gradeFromOrder,
  sidesFor,
  toPlannedOutputs,
  toPrintedOutputs,
  totalOf,
  type Grade,
} from "./grade";

type Props = {
  /** Null + open=true → create mode; non-null → edit mode. */
  order: PrintOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHEET_CLASS =
  "flex h-full w-[520px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";
const SECTION_CLASS =
  "mb-[10px] mt-[18px] flex items-center justify-between border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";
const FIELD_INPUT_CLASS =
  "h-auto rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[11px] py-[8px] text-[13px] text-[color:var(--orion-ink)] shadow-none focus-visible:border-[color:var(--brand-prod)] focus-visible:ring-[3px] focus-visible:ring-[color:color-mix(in_oklab,var(--brand-prod)_16%,transparent)] focus-visible:outline-none";
const PRIMARY_BTN =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95";
const GHOST_BTN =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

/** Rate (m/piece) by technique — mirrors the backend rate constants. */
const RATE: Record<string, number> = { dtf: 0.35, sublimation: 0.5 };

/** Paper types compatible with each technique (mirrors backend validation). */
function rollCompatible(paperType: PaperType, technique: string): boolean {
  if (technique === "dtf") return paperType === "dtf_film";
  if (technique === "sublimation") return paperType === "sublimation_paper" || paperType === "transfer_paper";
  return false;
}

export function PrintOrderDetailSheet({ order, open, onOpenChange }: Props) {
  const t = useTranslations("printOrders");
  const isNew = order === null;

  const createOrder = useCreatePrintOrder();
  const updateOrder = useUpdatePrintOrder();
  const completeOrder = useCompletePrintOrder();

  // Only transfer-based designs can be printed (silkscreen is excluded).
  const printsQuery = usePrints({ page_size: 100 });
  const transferDesigns = useMemo(
    () => (printsQuery.data?.items ?? []).filter((p) => p.technique !== "silkscreen"),
    [printsQuery.data],
  );
  const paperQuery = usePaperRolls({ page_size: 100 });

  // ----- form state (re-seeded when the opened entity changes) -----
  const [designId, setDesignId] = useState<string>(order?.design.id ?? "");
  const [rollId, setRollId] = useState<string>(order?.paper_roll?.id ?? "");
  const [grade, setGrade] = useState<Grade>({});
  const [consumed, setConsumed] = useState<string>(order?.meters_consumed ?? "");
  const [seedKey, setSeedKey] = useState<string | null>(null);

  // The opened entity's identity: order id for edit, "__new__" for create.
  const identity = order?.id ?? (open ? "__new__" : null);
  const allDesigns = printsQuery.data?.items ?? [];
  const design: Print | undefined = allDesigns.find((p) => p.id === designId);

  // Seed once per opened entity. For edit we must wait until the prints list has
  // resolved so the order's design object is available to hydrate the grade
  // (the design is looked up by the order's own design id, NOT by `designId` —
  // which is only set here, so gating on it would deadlock the seed).
  const seedDesign = isNew ? undefined : allDesigns.find((p) => p.id === order?.design.id);
  const printsReady = !isNew && (printsQuery.isSuccess || allDesigns.length > 0);
  if (identity !== null && identity !== seedKey && (isNew || printsReady)) {
    setDesignId(order?.design.id ?? "");
    setRollId(order?.paper_roll?.id ?? "");
    setConsumed(order?.meters_consumed ?? "");
    setGrade(isNew ? {} : gradeFromOrder(seedDesign, order));
    setSeedKey(identity);
  }

  function handleDesignChange(value: string) {
    setDesignId(value);
    const next = transferDesigns.find((p) => p.id === value);
    setGrade(emptyGrade(next));
    setRollId("");
  }

  function setCell(variationId: string, side: "front" | "back", key: "planned" | "printed", value: number) {
    setGrade((prev) => {
      const k = `${variationId}|${side}`;
      const cur = prev[k] ?? { planned: 0, printed: 0 };
      return { ...prev, [k]: { ...cur, [key]: value } };
    });
  }

  const totalPlanned = totalOf(grade, "planned");
  const totalPrinted = totalOf(grade, "printed");
  const rate = design ? (RATE[design.technique] ?? 0.4) : 0.4;
  const previsto = Number((rate * totalPrinted).toFixed(2));
  const consumedNum = consumed === "" ? 0 : Number(consumed);
  const delta = Number((consumedNum - previsto).toFixed(2));

  const posted = !isNew && order?.printed_at != null;
  const roll = (paperQuery.data?.items ?? []).find((r) => r.id === rollId);

  const suitableRolls = useMemo(() => {
    const all = paperQuery.data?.items ?? [];
    if (!design) return all;
    const filtered = all.filter((r) => rollCompatible(r.paper_type, design.technique));
    return filtered.length ? filtered : all;
  }, [paperQuery.data, design]);

  async function handleCreate() {
    if (!designId) return;
    try {
      await createOrder.mutateAsync({
        print_design_id: designId,
        paper_roll_id: rollId || null,
        planned_outputs: toPlannedOutputs(grade),
      });
      toast.success(t("form.toasts.created"));
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  async function handleSave() {
    if (!order) return;
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        payload: {
          paper_roll_id: rollId || null,
          printed_outputs: toPrintedOutputs(grade),
        },
      });
      toast.success(t("form.toasts.updated"));
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  async function handleLaunch() {
    if (!order) return;
    try {
      // Persist the recorded counts + roll first so completion sums them.
      await updateOrder.mutateAsync({
        id: order.id,
        payload: {
          paper_roll_id: rollId || null,
          printed_outputs: toPrintedOutputs(grade),
        },
      });
      await completeOrder.mutateAsync({
        id: order.id,
        payload: { meters_consumed: consumed !== "" ? consumed : null },
      });
      toast.success(t("form.toasts.launched"));
      onOpenChange(false);
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "";
      toast.error(t("form.toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  const sides = sidesFor(design);
  const busy = createOrder.isPending || updateOrder.isPending || completeOrder.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CLASS} data-testid="print-order-detail-sheet">
        <SheetHeader
          className="flex-row items-center gap-3 border-b border-[color:var(--orion-line-soft)] p-0"
          style={{ padding: "18px 22px" }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {isNew ? t("form.title.new") : t("form.title.edit", { code: order?.code ?? "" })}
            </SheetTitle>
            <SheetDescription className="text-[12px] text-[color:var(--orion-ink-3)]">
              {isNew ? t("form.title.newSub") : (order?.design.name ?? "")}
            </SheetDescription>
          </div>
          {!isNew && order ? <PrintOrderStatusPill status={order.status} /> : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto" style={{ padding: "18px 22px" }}>
          {/* Hero */}
          <div className="mb-[18px] flex items-center gap-3.5 rounded-[12px] bg-[color:var(--orion-surface-2)] p-[18px]">
            {design ? (
              <TransferChip imageUrl={design.image_url} size={48} />
            ) : (
              <span
                className="grid size-12 place-items-center rounded-[12px]"
                style={{
                  background: "color-mix(in oklab, var(--brand-prod) 14%, var(--orion-surface))",
                  color: "var(--brand-prod)",
                }}
              >
                <Printer size={22} strokeWidth={1.6} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-serif text-[17px] text-[color:var(--orion-ink)]">
                {design ? design.name : t("detail.pickEstampa")}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[color:var(--orion-ink-3)]">
                {design ? (
                  <>
                    <span className="inline-flex items-center rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-1.5 py-px text-[10.5px] uppercase">
                      {t(`techniques.${design.technique}`)}
                    </span>
                    <span>
                      {rollId ? t("detail.rollLinked", { code: roll ? paperRollCode(roll.id) : "" }) : t("detail.noRoll")}
                    </span>
                    {totalPlanned > 0 ? <span>· {t("detail.plannedCount", { n: totalPlanned })}</span> : null}
                  </>
                ) : (
                  <span>{t("detail.gradeHint")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Estampa selector */}
          <div className="font-medium text-[12px] text-[color:var(--orion-ink-2)]">{t("detail.estampa")}</div>
          <div className="mt-1.5">
            <Select value={designId} onValueChange={handleDesignChange} disabled={posted}>
              <SelectTrigger className={FIELD_INPUT_CLASS} data-testid="print-order-estampa-select">
                <SelectValue placeholder={t("detail.estampaPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {transferDesigns.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-flex items-center gap-2">
                      <TransferChip imageUrl={p.image_url} size={20} />
                      {p.name}
                      <span className="text-[10.5px] text-[color:var(--orion-ink-3)]">
                        {p.code} · {t(`techniques.${p.technique}`)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paper roll selector */}
          <div className={SECTION_CLASS}>
            <span>{t("detail.paperRoll")}</span>
            {design ? (
              <span
                className="rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal"
                style={{
                  color: "var(--brand-prod)",
                  background: "color-mix(in oklab, var(--brand-prod) 14%, var(--orion-surface))",
                }}
              >
                {t("consumptionRate", { rate })}
              </span>
            ) : null}
          </div>
          <Select value={rollId} onValueChange={setRollId} disabled={posted}>
            <SelectTrigger className={FIELD_INPUT_CLASS} data-testid="print-order-roll-select">
              <SelectValue placeholder={t("detail.rollPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {suitableRolls.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <span className="inline-flex items-center gap-2">
                    <Scroll size={13} strokeWidth={1.6} />
                    <span className="font-mono">{paperRollCode(r.id)}</span>
                    <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                      {t(`paperTypes.${r.paper_type}`)} · {Number(r.current_meters).toFixed(0)} m
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Side grids */}
          <div className={SECTION_CLASS}>
            <span>{t("detail.sidesGrid")}</span>
            {totalPlanned > 0 ? (
              <span className="font-medium normal-case tracking-normal text-[color:var(--orion-ink-2)]">
                {isNew ? `${totalPlanned} ${t("detail.total")}` : `${totalPrinted} / ${totalPlanned}`}
              </span>
            ) : null}
          </div>
          {!design ? (
            <div className="rounded-[10px] border border-dashed border-[color:var(--orion-line)] bg-[color:var(--orion-surface-2)] px-3.5 py-5 text-center text-[12px] text-[color:var(--orion-ink-3)]">
              {t("detail.pickEstampaGrid")}
            </div>
          ) : (
            <div data-testid="print-order-side-grid">
              {sides.map((side) => (
                <SideGrid
                  key={side}
                  design={design}
                  side={side}
                  grade={grade}
                  isNew={isNew}
                  onCell={setCell}
                  testId={`print-order-side-grid-${side}`}
                />
              ))}
            </div>
          )}

          {/* Paper consumption preview (edit only) */}
          {!isNew && design ? (
            <>
              <div className={SECTION_CLASS}>
                <span>{t("detail.paperConsumed")}</span>
                <span className="font-normal normal-case tracking-normal text-[10.5px] text-[color:var(--orion-ink-3)]">
                  {t("detail.consumptionLegend")}
                </span>
              </div>
              {rollId ? (
                <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
                  <div
                    className="grid items-center gap-3 px-3.5 py-3"
                    style={{ gridTemplateColumns: "1fr 90px 120px 64px" }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Scroll size={16} strokeWidth={1.6} className="text-[color:var(--orion-ink-2)]" />
                      <div className="min-w-0">
                        <div className="font-mono text-[12px] text-[color:var(--orion-ink)]">
                          {roll ? paperRollCode(roll.id) : ""}
                        </div>
                        <div className="truncate text-[11px] text-[color:var(--orion-ink-3)]">
                          {roll ? t(`paperTypes.${roll.paper_type}`) : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[13px] tabular-nums text-[color:var(--orion-ink-2)]">
                      {previsto.toFixed(1)} <span className="text-[11px] text-[color:var(--orion-ink-3)]">m</span>
                    </div>
                    <NumberInput
                      tone="prod"
                      step={0.5}
                      min={0}
                      decimals={1}
                      align="right"
                      suffix="m"
                      aria-label={t("detail.consumido")}
                      data-testid="print-order-consumed"
                      value={consumed}
                      onChange={setConsumed}
                    />
                    <div
                      className="text-right text-[12px] tabular-nums"
                      style={{
                        color:
                          consumedNum === 0
                            ? "var(--orion-ink-3)"
                            : delta > 0.05
                              ? "var(--status-err)"
                              : delta < -0.05
                                ? "var(--status-ok)"
                                : "var(--orion-ink-3)",
                      }}
                      data-testid="print-order-consumed-delta"
                    >
                      {consumedNum === 0 ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-3.5 py-3.5 text-center text-[12px] text-[color:var(--orion-ink-3)]">
                  {t("detail.pickRollForConsumption")}
                </div>
              )}
            </>
          ) : null}
        </div>

        <SheetFooter
          className="flex-row items-center gap-2 border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-0 sm:justify-end"
          style={{ padding: "14px 22px" }}
        >
          {isNew ? (
            <>
              <Button type="button" variant="ghost" className={GHOST_BTN} onClick={() => onOpenChange(false)}>
                {t("form.cancel")}
              </Button>
              <Button
                type="button"
                className={PRIMARY_BTN}
                disabled={!designId || busy}
                onClick={() => void handleCreate()}
                style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
              >
                <Printer size={13} strokeWidth={1.8} />
                {t("actions.create")}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                className={GHOST_BTN}
                disabled={busy}
                onClick={() => void handleSave()}
              >
                <Check size={13} strokeWidth={2.2} />
                {t("actions.save")}
              </Button>
              {posted ? (
                <Button
                  type="button"
                  disabled
                  className="h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium shadow-none"
                  style={{ color: "var(--status-ok)" }}
                  data-testid="print-order-in-stock"
                >
                  <CheckCircle2 size={13} strokeWidth={2} />
                  {t("inStock")}
                </Button>
              ) : (
                <Button
                  type="button"
                  className={PRIMARY_BTN}
                  disabled={busy}
                  onClick={() => void handleLaunch()}
                  data-testid="print-order-launch"
                  style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
                >
                  <Stamp size={13} strokeWidth={1.8} />
                  {t("actions.launch")}
                </Button>
              )}
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
