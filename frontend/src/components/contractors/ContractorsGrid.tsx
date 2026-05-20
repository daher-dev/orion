"use client";

import { ChevronRight, Factory, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Contractor } from "@/lib/schemas/contractor";
import { useShipments } from "@/hooks/use-sewing";

/**
 * Grid of contractor cards — direct port of the `Contractors` panel in
 * /docs/design/source/pages/production.jsx. Each card shows a 48×48 teal
 * factory mark, the contractor name (serif 17px) and primary contact,
 * then a 2-column metric strip with:
 *   • Ativas — number of open (sent/partial) shipments
 *   • No prazo — % of received shipments delivered on or before sent_at + 7d
 *
 * Metrics are derived live from the shipment list because the backend
 * doesn't ship aggregate counters yet — when there are no shipments yet,
 * we render an em-dash so the card still looks balanced.
 */

type Props = {
  data: Contractor[];
  onView: (contractor: Contractor) => void;
};

type Metrics = { active: number; ontime: number | null };

const EMPTY_METRICS: Metrics = { active: 0, ontime: null };

/**
 * Build {active, ontime%} per contractor from a flat shipment list.
 * Active = sent + partial. Ontime% = received shipments where
 * `received_at - sent_at <= 7 days` over total received.
 */
function metricsFor(contractorId: string, shipments: Array<{
  contractor: { id: string };
  status: string;
  sent_at: string;
  received_at?: string | null;
}> | undefined): Metrics {
  if (!shipments) return EMPTY_METRICS;
  const own = shipments.filter((s) => s.contractor.id === contractorId);
  const active = own.filter((s) => s.status === "sent" || s.status === "partial").length;
  const completed = own.filter((s) => s.status === "received" && s.received_at);
  if (completed.length === 0) return { active, ontime: null };
  const onTimeCount = completed.reduce((acc, s) => {
    const sent = new Date(s.sent_at).getTime();
    const recv = new Date(s.received_at as string).getTime();
    if (Number.isNaN(sent) || Number.isNaN(recv)) return acc;
    const diffDays = (recv - sent) / 86_400_000;
    return diffDays <= 7 ? acc + 1 : acc;
  }, 0);
  return { active, ontime: Math.round((onTimeCount / completed.length) * 100) };
}

export function ContractorsGrid({ data, onView }: Props) {
  const t = useTranslations("contractors");
  // Fetch a generous page of shipments so we can derive per-contractor
  // metrics without N+1 queries. 100 covers the prototype seed.
  const shipmentsQ = useShipments({ page_size: 100 });
  const allShipments = shipmentsQ.data?.items;

  return (
    <div
      data-testid="contractors-grid"
      className="grid"
      style={{ gap: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
    >
      {data.map((b) => {
        const metrics = metricsFor(b.id, allShipments);
        const ontimeColor =
          metrics.ontime === null
            ? "var(--orion-ink-2)"
            : metrics.ontime >= 90
              ? "var(--status-ok)"
              : metrics.ontime >= 80
                ? "var(--status-warn)"
                : "var(--status-err)";
        return (
          <button
            key={b.id}
            type="button"
            data-testid="contractor-card"
            onClick={() => onView(b)}
            // .card.card-pad equivalent — surface bg, 1px line, 14px radius,
            // 18px/20px inner padding. Hover lifts the border to the active
            // (terracotta-ish) tone — but here we just keep it warm.
            className="group cursor-pointer rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] text-left transition-colors hover:border-[color:var(--orion-ink-3)]"
            style={{ padding: "18px 20px" }}
          >
            {/* Header — 48px teal factory mark + name + contact + chevron */}
            <div className="flex items-center gap-3.5">
              <div
                aria-hidden
                className="grid place-items-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background:
                    "color-mix(in oklab, var(--brand-prod) 12%, var(--orion-surface))",
                  color: "var(--brand-prod)",
                }}
              >
                <Factory size={22} strokeWidth={1.6} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="truncate font-serif text-[17px] text-[color:var(--orion-ink)]">
                  {b.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-[color:var(--orion-ink-3)]">
                  {b.phone ? (
                    <>
                      <Phone size={11} strokeWidth={1.6} />
                      <span className="truncate">{b.phone}</span>
                    </>
                  ) : b.address ? (
                    <span className="truncate">{b.address}</span>
                  ) : (
                    <span className="italic">{t("table.columns.phone")}: —</span>
                  )}
                </div>
              </div>
              <ChevronRight
                size={16}
                strokeWidth={1.8}
                className="text-[color:var(--orion-ink-3)] transition-transform group-hover:translate-x-0.5"
              />
            </div>

            {/* Metric strip — 2 columns, top border */}
            <div
              className="grid items-baseline border-t border-[color:var(--orion-line-soft)]"
              style={{
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 12,
                marginTop: 16,
                paddingTop: 14,
              }}
            >
              <div>
                <div
                  className="font-serif text-[color:var(--orion-ink)]"
                  style={{ fontSize: 22, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
                >
                  {metrics.active}
                </div>
                <div
                  className="text-[color:var(--orion-ink-3)] uppercase"
                  style={{ fontSize: 10.5, letterSpacing: "0.08em", marginTop: 2 }}
                >
                  {t("metrics.active")}
                </div>
              </div>
              <div>
                <div
                  className="font-serif"
                  style={{
                    fontSize: 22,
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
                  {t("metrics.ontime")}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
