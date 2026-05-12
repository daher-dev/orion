"use client";

import { useState } from "react";
import { Factory, PackageCheck, Scissors } from "lucide-react";
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className={SHEET_CLASS} side="right">
          <SheetHeader
            className="border-b border-[color:var(--orion-line-soft)]"
            style={{ padding: "18px 22px" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
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
              <div className="flex flex-col gap-4">
                {/* Meta block */}
                <section className="rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4">
                  <dl className="flex flex-col gap-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                        {t("table.columns.contractor")}
                      </dt>
                      <dd className="flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--orion-ink)]">
                        <Factory size={12} strokeWidth={1.6} className="text-[color:var(--brand-prod)]" />
                        {shipment.contractor.name}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                        {t("table.columns.cuttingOrder")}
                      </dt>
                      <dd className="flex items-center gap-1.5 text-[13px] font-mono text-[color:var(--orion-ink-2)]">
                        <Scissors size={11} strokeWidth={1.8} className="text-[color:var(--orion-ink-3)]" />
                        {shipment.cutting_order.code}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                        {t("table.columns.sentAt")}
                      </dt>
                      <dd className="text-[12px] text-[color:var(--orion-ink-3)]">
                        {sentDate && !Number.isNaN(sentDate.getTime())
                          ? format.dateTime(sentDate, {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </dd>
                    </div>
                    {receivedDate ? (
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                          {t("table.columns.receivedAt")}
                        </dt>
                        <dd className="text-[12px] text-[color:var(--orion-ink-3)]">
                          {!Number.isNaN(receivedDate.getTime())
                            ? format.dateTime(receivedDate, {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                            : "—"}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                {/* Pieces breakdown */}
                <section className="rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4">
                  <h3 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {t("table.columns.totals")}
                  </h3>
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
                              className={i < SIZES.length - 1 ? "border-b border-[color:var(--orion-line-soft)]" : ""}
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
                </section>
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
