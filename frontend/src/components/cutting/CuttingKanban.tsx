"use client";

import { Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/inventory/KanbanBoard";
import { sumOutputs, type CuttingOrder, type CuttingStatus } from "@/lib/schemas/cutting";
import { useUpdateCuttingOrder } from "@/hooks/use-cutting";
import { useCanAccess } from "@/hooks/use-permissions";
import { CuttingStatusPill } from "./CuttingStatusPill";

/**
 * Kanban board for cutting orders. Renders via the shared `KanbanBoard`
 * (three columns Pendente / Cortando / Concluído) — the board owns drag-and-drop
 * + column chrome; this component owns the cutting card visuals and the
 * status-PATCH move handler. The `cutting-kanban*` testids are preserved (the
 * shared board's `testidPrefix` re-emits `cutting-kanban`, `-col-*`, `-card`).
 */

type Props = {
  rows: CuttingOrder[];
  onView: (order: CuttingOrder) => void;
  onCreate?: () => void;
};

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function formatCutDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // dd/mm — mirrors the "08/05" format the design source renders.
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function CuttingKanban({ rows, onView, onCreate }: Props) {
  const t = useTranslations("cutting");
  const canWrite = useCanAccess("cutting.write");
  const update = useUpdateCuttingOrder();

  const columns = [
    { id: "pending", label: <CuttingStatusPill status="pending" /> },
    { id: "cutting", label: <CuttingStatusPill status="cutting" /> },
    { id: "done", label: <CuttingStatusPill status="done" /> },
  ];

  async function handleMove(order: CuttingOrder, targetStatus: string) {
    try {
      await update.mutateAsync({
        id: order.id,
        payload: { status: targetStatus as CuttingStatus },
      });
      toast.success(t("form.toasts.updated"));
    } catch {
      toast.error(t("form.toasts.error"));
    }
  }

  return (
    <KanbanBoard<CuttingOrder>
      testidPrefix="cutting-kanban"
      columns={columns}
      items={rows}
      canMove={canWrite}
      getColumnId={(o) => o.status}
      getItemId={(o) => o.id}
      onMove={handleMove}
      renderColumnAction={(colId) =>
        colId === "pending" && onCreate && canWrite ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCreate}
            aria-label={t("actions.create")}
            className="h-auto rounded-[5px] px-2 py-1 text-[12px] text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]"
          >
            <Scissors size={12} strokeWidth={1.8} />
          </Button>
        ) : null
      }
      renderCard={(c) => {
        const planned = sumOutputs(c.planned_outputs);
        const actual = sumOutputs(c.actual_outputs);
        const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
        return (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onView(c)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onView(c);
              }
            }}
            style={{
              background: "var(--orion-bg)",
              border: "1px solid var(--orion-line-soft)",
              borderRadius: "var(--radius-sm)",
              padding: 12,
            }}
          >
            {/* Card head: code (mono) + cut date */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[color:var(--orion-ink-3)]" style={{ fontSize: 11.5 }}>
                {shortId(c.id)}
              </span>
              <span
                className="text-[11px] text-[color:var(--orion-ink-3)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatCutDate(c.cut_at)}
              </span>
            </div>

            {/* Spec name + colour */}
            <div className="flex items-baseline gap-2" style={{ marginTop: 4 }}>
              <span
                className="font-serif text-[color:var(--orion-ink)]"
                style={{ fontSize: 15, lineHeight: 1.15 }}
              >
                {c.spec.name}
              </span>
              <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">{c.color}</span>
            </div>

            {/* Fabric/roll row: small swatch + body_roll code + counts */}
            <div
              className="flex items-center gap-2 text-[color:var(--orion-ink-3)]"
              style={{ marginTop: 10, fontSize: 11.5 }}
            >
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background:
                    "repeating-linear-gradient(135deg, #f4d9b8 0 4px, rgba(194,65,12,.13) 4px 8px)",
                  border: "1px solid rgba(194,65,12,.20)",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              <span className="font-mono" style={{ fontSize: 11.5 }}>
                {c.body_roll?.code ?? "—"}
              </span>
              <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                {actual}/{planned} {t("kanban.pieces")}
              </span>
            </div>

            {/* Progress bar — 4px, teal fill */}
            <div
              style={{
                height: 4,
                background: "var(--orion-line-soft)",
                borderRadius: 999,
                marginTop: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: "var(--brand-prod)",
                  borderRadius: 999,
                  transition: "width .25s ease",
                }}
              />
            </div>
          </div>
        );
      }}
    />
  );
}
