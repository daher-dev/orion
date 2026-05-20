"use client";

import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Factory,
  PackageCheck,
  Package,
  Scissors,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SIZES } from "@/lib/schemas/product";
import { sumReceived, sumRequested, type Shipment } from "@/lib/schemas/sewing";
import { useCanAccess } from "@/hooks/use-permissions";
import { ShipmentReceiveDialog } from "./ShipmentReceiveDialog";
import { ShipmentStatusPill } from "./ShipmentStatusPill";

type Props = {
  shipment: Shipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

const SHEET_CLASS =
  "flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

const SECTION_CLASS =
  "mb-[10px] text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";

/**
 * 4-step timeline — direct port of the `SewingDetail` panel in
 * /docs/design/source/pages/production.jsx. Steps map to the shipment
 * lifecycle and are highlighted up to and including the current status.
 */
type TimelineStep = {
  id: "sent" | "production" | "partial" | "received";
  label: string;
  icon: LucideIcon;
  date?: string;
};

function getStepIndex(status: Shipment["status"]): number {
  switch (status) {
    case "sent":
      return 1; // sent + in production both lit
    case "partial":
      return 2;
    case "received":
      return 3;
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

function Timeline({
  steps,
  currentIndex,
}: {
  steps: TimelineStep[];
  currentIndex: number;
}) {
  return (
    <div
      className="relative flex"
      style={{ gap: 0, marginBottom: 22 }}
      data-testid="shipment-timeline"
    >
      {steps.map((step, i) => {
        const Icon = step.icon;
        const reached = i <= currentIndex;
        return (
          <div
            key={step.id}
            className="relative flex flex-1 flex-col items-center"
          >
            {/* Connector line — design source: 2px, top 14, left 50% to
                right -50% so it spans into the next column's left half. */}
            {i < steps.length - 1 ? (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 14,
                  left: "50%",
                  right: "-50%",
                  height: 2,
                  background: reached ? "var(--brand-prod)" : "var(--orion-line-soft)",
                  zIndex: 0,
                }}
              />
            ) : null}

            {/* Step dot — 30×30, brand-prod when reached, surface + 1.5px
                line border when not. */}
            <span
              className="relative z-10 grid place-items-center rounded-full"
              style={{
                width: 30,
                height: 30,
                background: reached ? "var(--brand-prod)" : "var(--orion-surface)",
                border: reached ? "none" : "1.5px solid var(--orion-line)",
                color: reached ? "#fff" : "var(--orion-ink-3)",
              }}
            >
              <Icon size={13} strokeWidth={1.8} />
            </span>

            {/* Step label + optional date */}
            <div
              className="text-center"
              style={{
                fontSize: 10.5,
                marginTop: 6,
                color: reached ? "var(--orion-ink)" : "var(--orion-ink-3)",
                fontWeight: reached ? 500 : 400,
                lineHeight: 1.25,
              }}
            >
              {step.label}
            </div>
            {step.date ? (
              <div
                style={{
                  fontSize: 10,
                  marginTop: 2,
                  color: "var(--orion-ink-3)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {step.date}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StatLine({
  icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        <Icon size={11} strokeWidth={1.8} />
        {label}
      </dt>
      <dd className="text-[13px] text-[color:var(--orion-ink-2)]">{children}</dd>
    </div>
  );
}

export function ShipmentDetailSheet({ shipment, open, onOpenChange }: Props) {
  const t = useTranslations("sewing");
  const format = useFormatter();
  const canWrite = useCanAccess("sewing.write");
  const [receiving, setReceiving] = useState(false);

  const canReceive =
    canWrite &&
    shipment !== null &&
    (shipment.status === "sent" || shipment.status === "partial");

  const sentDate = shipment ? new Date(shipment.sent_at) : null;
  const receivedDate = shipment?.received_at ? new Date(shipment.received_at) : null;

  const totalRequested = shipment ? sumRequested(shipment.items) : 0;
  const totalReceived = shipment ? sumReceived(shipment.items) : 0;

  function fmtDate(d: Date | null): string {
    if (!d || Number.isNaN(d.getTime())) return "—";
    return format.dateTime(d, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const currentIndex = shipment ? getStepIndex(shipment.status) : 0;
  const timelineSteps: TimelineStep[] = shipment
    ? [
        {
          id: "sent",
          label: t("status.sent"),
          icon: Send,
          date: fmtDate(sentDate),
        },
        {
          id: "production",
          label: t("timeline.production"),
          icon: Scissors,
          date: shipment.status === "sent" ? t("timeline.inProgress") : "—",
        },
        {
          id: "partial",
          label: t("status.partial"),
          icon: Package,
          date:
            shipment.status === "partial" || shipment.status === "received"
              ? t("timeline.inProgress")
              : "—",
        },
        {
          id: "received",
          label: t("status.received"),
          icon: CheckCircle2,
          date: receivedDate ? fmtDate(receivedDate) : "—",
        },
      ]
    : [];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className={SHEET_CLASS} side="right">
          <SheetHeader
            className="border-b border-[color:var(--orion-line-soft)]"
            style={{ padding: "18px 22px" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <SheetTitle className="flex items-center gap-2 font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
                  {shipment ? shortId(shipment.id) : t("actions.view")}
                  {shipment ? <ShipmentStatusPill status={shipment.status} /> : null}
                </SheetTitle>
                {shipment ? (
                  <SheetDescription className="flex items-center gap-1.5 text-[12px] text-[color:var(--orion-ink-3)]">
                    <Factory size={11} strokeWidth={1.6} />
                    {shipment.contractor.name}
                  </SheetDescription>
                ) : null}
              </div>
              {canReceive ? (
                <Button
                  type="button"
                  onClick={() => setReceiving(true)}
                  className="h-auto shrink-0 gap-[6px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[12px] py-[7px] text-[12px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset] hover:bg-[color-mix(in_oklab,var(--brand-prod)_88%,black)]"
                  style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
                >
                  <PackageCheck size={12} strokeWidth={1.8} />
                  {t("actions.receive")}
                </Button>
              ) : null}
            </div>
          </SheetHeader>

          <div
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ padding: "18px 22px" }}
          >
            {!shipment ? null : (
              <div className="flex flex-col">
                {/* Hero — contractor name + status, teal factory mark.
                    Direct port of the design's `SewingDetail`. */}
                <div
                  className="mb-[18px] flex items-center gap-3.5 rounded-[12px] p-[18px]"
                  style={{ background: "var(--orion-surface-2)" }}
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
                    <Factory size={22} strokeWidth={1.6} />
                  </span>
                  <div className="flex flex-1 flex-col">
                    <div className="font-serif text-[17px] text-[color:var(--orion-ink)]">
                      {shipment.contractor.name}
                    </div>
                    <div className="font-mono text-[11px] text-[color:var(--orion-ink-3)]" style={{ marginTop: 2 }}>
                      {shortId(shipment.id)}
                    </div>
                  </div>
                  <ShipmentStatusPill status={shipment.status} />
                </div>

                {/* Timeline */}
                <div className={SECTION_CLASS}>{t("timeline.title")}</div>
                {shipment.status === "cancelled" ? (
                  <div
                    className="mb-[18px] flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[12.5px]"
                    style={{
                      color: "var(--status-err)",
                      background:
                        "color-mix(in oklab, var(--status-err) 10%, var(--orion-surface))",
                      borderColor:
                        "color-mix(in oklab, var(--status-err) 22%, var(--orion-surface))",
                    }}
                  >
                    <XCircle size={13} strokeWidth={1.8} />
                    {t("timeline.cancelled")}
                  </div>
                ) : (
                  <Timeline steps={timelineSteps} currentIndex={currentIndex} />
                )}

                {/* Meta — cutting order, sent/received dates */}
                <section className="mb-4 rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4">
                  <dl className="flex flex-col gap-3">
                    <StatLine icon={Scissors} label={t("table.columns.cuttingOrder")}>
                      <span className="font-mono text-[12px]">
                        {shipment.cutting_order.code}
                      </span>
                    </StatLine>
                    <StatLine icon={Send} label={t("table.columns.sentAt")}>
                      <span className="text-[12px] text-[color:var(--orion-ink-3)]">
                        {fmtDate(sentDate)}
                      </span>
                    </StatLine>
                    {receivedDate ? (
                      <StatLine icon={PackageCheck} label={t("table.columns.receivedAt")}>
                        <span className="text-[12px] text-[color:var(--orion-ink-3)]">
                          {fmtDate(receivedDate)}
                        </span>
                      </StatLine>
                    ) : null}
                    <StatLine icon={Package} label={t("table.columns.totals")}>
                      <span
                        className="text-[13px] font-medium"
                        style={{
                          color:
                            totalReceived >= totalRequested && totalRequested > 0
                              ? "var(--status-ok)"
                              : totalReceived > 0
                                ? "var(--status-warn)"
                                : "var(--orion-ink-2)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {totalReceived}
                        <span className="text-[color:var(--orion-ink-3)]"> / {totalRequested}</span>
                      </span>
                    </StatLine>
                  </dl>
                </section>

                {/* Pieces breakdown */}
                <div className={SECTION_CLASS}>{t("detail.itemsTitle")}</div>
                <div className="overflow-hidden rounded-[8px] border border-[color:var(--orion-line-soft)]">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)]">
                        <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                          {t("detail.size")}
                        </th>
                        <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                          {t("detail.requested")}
                        </th>
                        <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                          {t("detail.received")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {SIZES.map((size, i) => {
                        const item = shipment.items.find((it) => it.size === size);
                        if (!item || item.requested_quantity === 0) return null;
                        return (
                          <tr
                            key={size}
                            className={
                              i < SIZES.length - 1
                                ? "border-b border-[color:var(--orion-line-soft)]"
                                : ""
                            }
                          >
                            <td className="px-3 py-2.5 font-mono font-medium text-[color:var(--orion-ink)]">
                              {size.toUpperCase()}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right text-[color:var(--orion-ink-2)]"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {item.requested_quantity}
                            </td>
                            <td
                              className="px-3 py-2.5 text-right font-medium"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              <span
                                style={{
                                  color:
                                    item.received_quantity >= item.requested_quantity
                                      ? "var(--status-ok)"
                                      : item.received_quantity > 0
                                        ? "var(--status-warn)"
                                        : "var(--orion-ink-3)",
                                }}
                              >
                                {item.received_quantity}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)]">
                        <td className="px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                          Total
                        </td>
                        <td
                          className="px-3 py-2 text-right text-[12px] font-medium text-[color:var(--orion-ink-2)]"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {totalRequested}
                        </td>
                        <td
                          className="px-3 py-2 text-right text-[12px] font-medium"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          <span
                            style={{
                              color:
                                totalReceived >= totalRequested
                                  ? "var(--status-ok)"
                                  : totalReceived > 0
                                    ? "var(--status-warn)"
                                    : "var(--orion-ink-3)",
                            }}
                          >
                            {totalReceived}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {shipment ? (
        <ShipmentReceiveDialog
          open={receiving}
          shipment={shipment}
          onOpenChange={(open) => {
            if (!open) setReceiving(false);
          }}
        />
      ) : null}
    </>
  );
}
