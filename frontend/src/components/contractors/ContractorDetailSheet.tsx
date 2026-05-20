"use client";

import {
  AlertTriangle,
  Factory,
  MapPin,
  Package,
  Pencil,
  Phone,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useShipments } from "@/hooks/use-sewing";
import { useCanAccess } from "@/hooks/use-permissions";
import { sumReceived, type Shipment } from "@/lib/schemas/sewing";
import type { Contractor } from "@/lib/schemas/contractor";
import { ShipmentStatusPill } from "@/components/sewing/ShipmentStatusPill";


/**
 * Detail sheet for a contractor — direct port of the `BancaDetail` panel
 * in /docs/design/source/pages/production.jsx.
 *
 * Header tile mirrors the design: 56×56 teal factory mark, name in
 * 18px serif, contact line with phone/address icons.
 *
 * Metrics strip below is a 2-cell grid (active/on-time%) backed by the
 * shipments query the parent grid already keys for the dashboard cards.
 *
 * History list shows the contractor's shipments sorted by sent_at desc.
 */

type Props = {
  contractor: Contractor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (contractor: Contractor) => void;
};

const SHEET_CLASS =
  "flex h-full w-[480px] max-w-full flex-col gap-0 border-l border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-0 shadow-[-8px_0_32px_-8px_rgba(31,27,21,0.18)] sm:max-w-none";

const SECTION_CLASS =
  "mb-[10px] text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]";

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function metricsFor(contractorId: string, shipments: Shipment[]) {
  const own = shipments.filter((s) => s.contractor.id === contractorId);
  const active = own.filter(
    (s) => s.status === "sent" || s.status === "partial",
  ).length;
  const completed = own.filter((s) => s.status === "received" && s.received_at);
  let ontime: number | null = null;
  if (completed.length > 0) {
    const onTimeCount = completed.reduce((acc, s) => {
      const sent = new Date(s.sent_at).getTime();
      const recv = new Date(s.received_at as string).getTime();
      if (Number.isNaN(sent) || Number.isNaN(recv)) return acc;
      return (recv - sent) / 86_400_000 <= 7 ? acc + 1 : acc;
    }, 0);
    ontime = Math.round((onTimeCount / completed.length) * 100);
  }
  const totalPieces = own.reduce((acc, s) => acc + sumReceived(s.items), 0);
  return { active, ontime, totalPieces, history: own };
}

export function ContractorDetailSheet({
  contractor,
  open,
  onOpenChange,
  onEdit,
}: Props) {
  const t = useTranslations("contractors");
  const format = useFormatter();
  const canEdit = useCanAccess("contractors.write");

  const shipmentsQ = useShipments({ page_size: 100 });
  const allShipments = shipmentsQ.data?.items ?? [];

  const metrics = contractor
    ? metricsFor(contractor.id, allShipments)
    : { active: 0, ontime: null as number | null, totalPieces: 0, history: [] as Shipment[] };

  const ontimeColor =
    metrics.ontime === null
      ? "var(--orion-ink)"
      : metrics.ontime >= 90
        ? "var(--status-ok)"
        : metrics.ontime >= 80
          ? "var(--status-warn)"
          : "var(--status-err)";

  // History sorted by sent_at desc
  const sortedHistory = [...metrics.history].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime(),
  );

  function fmtDate(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return format.dateTime(d, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={SHEET_CLASS} side="right">
        <SheetHeader
          className="border-b border-[color:var(--orion-line-soft)]"
          style={{ padding: "18px 22px" }}
        >
          <SheetTitle className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {contractor ? contractor.name : t("actions.edit")}
          </SheetTitle>
          {contractor ? (
            <SheetDescription className="font-mono text-[11.5px] text-[color:var(--orion-ink-3)]">
              {shortId(contractor.id)}
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ padding: "18px 22px" }}
        >
          {!contractor ? null : (
            <>
              {/* Hero tile — 56px mark + name + contact line */}
              <div
                className="mb-[18px] flex items-center gap-3.5 rounded-[12px] p-[18px]"
                style={{ background: "var(--orion-surface-2)" }}
              >
                <span
                  aria-hidden
                  className="grid place-items-center"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 14,
                    background:
                      "color-mix(in oklab, var(--brand-prod) 14%, var(--orion-surface))",
                    color: "var(--brand-prod)",
                  }}
                >
                  <Factory size={26} strokeWidth={1.6} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="truncate font-serif text-[18px] text-[color:var(--orion-ink)]">
                    {contractor.name}
                  </div>
                  <div
                    className="flex flex-wrap text-[color:var(--orion-ink-3)]"
                    style={{ fontSize: 12, marginTop: 4, gap: 12 }}
                  >
                    {contractor.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} strokeWidth={1.6} />
                        {contractor.phone}
                      </span>
                    ) : null}
                    {contractor.address ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} strokeWidth={1.6} />
                        {contractor.address}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Metrics — 2-column strip with a hairline grid bg trick */}
              <div className={SECTION_CLASS}>{t("detail.metrics")}</div>
              <div
                className="mb-[18px] grid overflow-hidden rounded-[10px]"
                style={{
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 1,
                  background: "var(--orion-line-soft)",
                  border: "1px solid var(--orion-line-soft)",
                }}
              >
                <div
                  className="bg-[color:var(--orion-surface)]"
                  style={{ padding: "14px 16px" }}
                >
                  <div
                    className="font-serif text-[color:var(--orion-ink)]"
                    style={{ fontSize: 26, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
                  >
                    {metrics.active}
                  </div>
                  <div
                    className="text-[color:var(--orion-ink-3)] uppercase"
                    style={{ fontSize: 10.5, letterSpacing: "0.08em", marginTop: 2 }}
                  >
                    {t("detail.activeShipments")}
                  </div>
                </div>
                <div
                  className="bg-[color:var(--orion-surface)]"
                  style={{ padding: "14px 16px" }}
                >
                  <div
                    className="font-serif"
                    style={{
                      fontSize: 26,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1,
                      color: ontimeColor,
                    }}
                  >
                    {metrics.ontime === null ? "—" : `${metrics.ontime}%`}
                  </div>
                  <div
                    className="text-[color:var(--orion-ink-3)] uppercase"
                    style={{ fontSize: 10.5, letterSpacing: "0.08em", marginTop: 2 }}
                  >
                    {t("detail.onTime")}
                  </div>
                </div>
              </div>

              {/* Totals row */}
              <div
                className="mb-[18px] flex items-center justify-between rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)]"
                style={{ padding: "12px 14px" }}
              >
                <div className="flex items-center gap-2 text-[12px] text-[color:var(--orion-ink-3)]">
                  <Package size={12} strokeWidth={1.6} />
                  {t("detail.totalPieces")}
                </div>
                <div
                  className="font-serif text-[18px] text-[color:var(--orion-ink)]"
                  style={{ fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
                >
                  {metrics.totalPieces}
                </div>
              </div>

              {/* History list */}
              <div
                style={{
                  borderTop: "1px solid var(--orion-line-soft)",
                  paddingTop: 14,
                }}
              >
                <div className={SECTION_CLASS}>{t("detail.history")}</div>
                {sortedHistory.length === 0 ? (
                  <div className="flex items-center gap-2 text-[12px] text-[color:var(--orion-ink-3)]">
                    <AlertTriangle size={11} strokeWidth={1.6} />
                    {t("detail.noHistory")}
                  </div>
                ) : (
                  <div>
                    {sortedHistory.map((r, i) => {
                      const last = i === sortedHistory.length - 1;
                      return (
                        <div
                          key={r.id}
                          className="flex items-center"
                          style={{
                            gap: 10,
                            padding: "10px 0",
                            borderBottom: last ? undefined : "1px solid var(--orion-line-soft)",
                          }}
                        >
                          <span
                            className="font-mono text-[color:var(--orion-ink-2)]"
                            style={{ fontSize: 12, minWidth: 80 }}
                          >
                            {shortId(r.id)}
                          </span>
                          <div className="flex-1 text-[color:var(--orion-ink-3)]" style={{ fontSize: 12 }}>
                            {t("detail.sentAt")} {fmtDate(r.sent_at)}
                            {r.received_at
                              ? ` · ${t("detail.receivedAt")} ${fmtDate(r.received_at)}`
                              : ""}
                          </div>
                          <span
                            className="text-[color:var(--orion-ink-2)]"
                            style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 50, textAlign: "right" }}
                          >
                            {sumReceived(r.items)} {t("detail.piecesUnit")}
                          </span>
                          <ShipmentStatusPill status={r.status} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
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
            {t("form.cancel")}
          </Button>
          {canEdit && contractor && onEdit ? (
            <Button
              type="button"
              onClick={() => onEdit(contractor)}
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:bg-[color-mix(in_oklab,var(--brand-prod)_88%,black)]"
              style={{ borderColor: "color-mix(in oklab, var(--brand-prod) 70%, black)" }}
            >
              <Pencil size={13} strokeWidth={1.8} />
              {t("actions.edit")}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
