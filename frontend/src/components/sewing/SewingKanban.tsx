"use client";

import { Calendar, Factory, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { type AvailableCut } from "@/lib/schemas/cutting";
import { sumReceived, sumRequested, type Shipment } from "@/lib/schemas/sewing";
import { SewingAvailableCard } from "./SewingAvailableCard";
import { ShipmentStatusPill } from "./ShipmentStatusPill";

type Props = {
  cuts: AvailableCut[];
  shipments: Shipment[];
  onView: (shipment: Shipment) => void;
  onCreateFromCut: (cut: AvailableCut) => void;
  onCreate: () => void;
  canWrite: boolean;
};

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Sewing kanban — port of the prototype's three-column Costura board:
 *   Disponível (cut pieces ready to send) · Costurando (at banca) · Recebido.
 *
 * The Disponível column is fed by the available-cuts read; clicking a card
 * opens "Nova remessa" pre-filled. The other two columns place shipments by
 * status (sent/partial → Costurando; received → Recebido), rendering compact
 * cards with per-size received/requested progress.
 */
export function SewingKanban({
  cuts,
  shipments,
  onView,
  onCreateFromCut,
  onCreate,
  canWrite,
}: Props) {
  const t = useTranslations("sewing");

  const sewing = shipments.filter((s) => s.status === "sent" || s.status === "partial");
  const received = shipments.filter((s) => s.status === "received");

  const columns = [
    { id: "available" as const, label: t("available.column"), count: cuts.length },
    { id: "sewing" as const, label: t("status.sent"), count: sewing.length },
    { id: "received" as const, label: t("status.received"), count: received.length },
  ];

  function renderShipmentCard(s: Shipment) {
    const requested = sumRequested(s.items);
    const rec = sumReceived(s.items);
    const items = s.items.filter((it) => it.requested_quantity > 0);
    return (
      <div
        key={s.id}
        data-testid="sewing-kanban-card"
        role="button"
        tabIndex={0}
        onClick={() => onView(s)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onView(s);
          }
        }}
        className="cursor-pointer rounded-[var(--radius-sm)] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] p-3 transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-[color:var(--brand-prod)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.07)]"
      >
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11.5px] text-[color:var(--orion-ink-3)]">
            {shortId(s.id)}
          </span>
          <ShipmentStatusPill status={s.status} />
        </div>

        {/* Per-size progress (received / requested) */}
        <div className="mt-2 grid gap-1.5">
          {items.map((it) => {
            const pct =
              it.requested_quantity > 0
                ? Math.min(100, (it.received_quantity / it.requested_quantity) * 100)
                : 0;
            const done = it.requested_quantity > 0 && it.received_quantity >= it.requested_quantity;
            return (
              <div key={it.id} className="flex items-center gap-2">
                <span className="grid h-[22px] min-w-7 place-items-center rounded-[5px] bg-[color:var(--orion-surface-2)] px-1.5 font-mono text-[11.5px] font-semibold text-[color:var(--orion-ink-2)]">
                  {it.size.toUpperCase()}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--orion-line-soft)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: done ? "var(--status-ok)" : "var(--brand-prod)",
                    }}
                  />
                </div>
                <span
                  className="shrink-0 font-serif text-[12px] tabular-nums"
                  style={{ color: done ? "var(--status-ok)" : "var(--orion-ink)" }}
                >
                  {it.received_quantity}
                  <span className="text-[color:var(--orion-ink-3)]">/{it.requested_quantity}</span>
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer meta */}
        <div className="mt-[11px] flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-[color:var(--orion-line-soft)] pt-2.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--orion-ink-2)]">
            <Factory size={11} />
            {s.contractor.name}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--orion-ink-3)]">
            <Calendar size={11} />
            {formatDate(s.received_at ?? s.sent_at)}
          </span>
          <span className="ml-auto font-serif text-[12px] text-[color:var(--orion-ink-3)] tabular-nums">
            {rec}/{requested}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="sewing-kanban"
      className="grid gap-[14px]"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
    >
      {columns.map((col) => (
        <div
          key={col.id}
          data-testid={col.id === "available" ? "sewing-available-column" : `sewing-kanban-col-${col.id}`}
          style={{
            background: "var(--orion-surface)",
            border: "1px solid var(--orion-line)",
            borderRadius: "var(--radius-lg)",
            padding: 12,
          }}
        >
          <div className="flex items-center justify-between" style={{ padding: "4px 6px 10px" }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-2)]">
                {col.label}
              </span>
              <span
                className="text-[11px] text-[color:var(--orion-ink-3)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {col.count}
              </span>
            </div>
            {col.id === "available" && canWrite ? (
              <button
                type="button"
                onClick={onCreate}
                aria-label={t("actions.create")}
                className="grid h-auto place-items-center rounded-[5px] px-2 py-1 text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]"
              >
                <Send size={12} strokeWidth={1.8} />
              </button>
            ) : null}
          </div>

          <div className="grid gap-2" style={{ minHeight: 40 }}>
            {col.id === "available"
              ? cuts.map((cut) => (
                  <SewingAvailableCard
                    key={cut.cutting_order_id}
                    cut={cut}
                    onCreate={onCreateFromCut}
                  />
                ))
              : (col.id === "sewing" ? sewing : received).map(renderShipmentCard)}
          </div>
        </div>
      ))}
    </div>
  );
}
