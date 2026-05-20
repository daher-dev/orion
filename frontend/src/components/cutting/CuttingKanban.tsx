"use client";

import { useState, type DragEvent } from "react";
import { Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sumOutputs, type CuttingOrder, type CuttingStatus } from "@/lib/schemas/cutting";
import { useUpdateCuttingOrder } from "@/hooks/use-cutting";
import { useCanAccess } from "@/hooks/use-permissions";
import { CuttingStatusPill } from "./CuttingStatusPill";

/**
 * Kanban board for cutting orders. Direct port of the `Cutting` panel in
 * /docs/design/source/pages/production.jsx — three columns (Pendente,
 * Cortando, Concluído), each rendering compact cards with code, product,
 * roll, planned/actual counts, a progress bar, and the operator avatar.
 *
 * Drag-and-drop moves cards between columns, optimistically updating the
 * card's status via PATCH /v1/cutting/{id}. The same item also opens the
 * detail sheet on click.
 */

type Props = {
  rows: CuttingOrder[];
  onView: (order: CuttingOrder) => void;
  onCreate?: () => void;
};

const COLUMN_BG = "var(--orion-surface)";
const COLUMN_BG_OVER = "color-mix(in oklab, var(--brand-prod) 6%, var(--orion-surface))";

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

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<CuttingStatus | null>(null);

  // Three-column layout exactly as the design — Pendente / Cortando /
  // Concluído. Keys map to backend cutting status enum values.
  const columns: Array<{ id: CuttingStatus; label: string }> = [
    { id: "pending", label: t("status.pending") },
    { id: "cutting", label: t("status.cutting") },
    { id: "done", label: t("status.done") },
  ];

  async function handleDrop(targetStatus: CuttingStatus) {
    if (!dragId) return;
    const dragged = rows.find((r) => r.id === dragId);
    setDragId(null);
    setOverCol(null);
    if (!dragged || dragged.status === targetStatus) return;
    try {
      await update.mutateAsync({
        id: dragged.id,
        payload: { status: targetStatus },
      });
      toast.success(t("form.toasts.updated"));
    } catch {
      toast.error(t("form.toasts.error"));
    }
  }

  return (
    <div
      data-testid="cutting-kanban"
      className="grid gap-[14px]"
      style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
    >
      {columns.map((col) => {
        const colItems = rows.filter((r) => r.status === col.id);
        const isOver = overCol === col.id;
        return (
          <div
            key={col.id}
            data-testid={`cutting-kanban-col-${col.id}`}
            onDragOver={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              setOverCol(col.id);
            }}
            onDragLeave={(e: DragEvent<HTMLDivElement>) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setOverCol(null);
              }
            }}
            onDrop={(e: DragEvent<HTMLDivElement>) => {
              e.preventDefault();
              void handleDrop(col.id);
            }}
            // .kanban-col — direct port of the design source: surface bg,
            // dashed teal border when something is dragged over it, otherwise
            // the standard line border + 14px radius card shell.
            style={{
              background: isOver ? COLUMN_BG_OVER : COLUMN_BG,
              border: `1px ${isOver ? "dashed" : "solid"} ${
                isOver ? "var(--brand-prod)" : "var(--orion-line)"
              }`,
              borderRadius: "var(--radius-lg)",
              padding: 12,
              transition: "background .15s, border-color .15s",
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ padding: "4px 6px 10px" }}
            >
              <div className="flex items-center gap-1.5">
                <CuttingStatusPill status={col.id} />
                <span
                  className="text-[11px] text-[color:var(--orion-ink-3)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {colItems.length}
                </span>
              </div>
              {col.id === "pending" && onCreate && canWrite ? (
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
              ) : null}
            </div>

            {/* Cards — empty columns still keep a 40px min-height so the
                drop target remains usable when dragging across. */}
            <div className="grid gap-2" style={{ minHeight: 40 }}>
              {colItems.map((c) => {
                const planned = sumOutputs(c.planned_outputs);
                const actual = sumOutputs(c.actual_outputs);
                const pct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
                const isDragging = dragId === c.id;
                return (
                  <div
                    key={c.id}
                    data-testid="cutting-kanban-card"
                    role="button"
                    tabIndex={0}
                    draggable={canWrite}
                    onClick={() => onView(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onView(c);
                      }
                    }}
                    onDragStart={(e) => {
                      setDragId(c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    style={{
                      background: "var(--orion-bg)",
                      border: "1px solid var(--orion-line-soft)",
                      borderRadius: "var(--radius-sm)",
                      padding: 12,
                      cursor: canWrite ? "grab" : "pointer",
                      opacity: isDragging ? 0.4 : 1,
                      transition: "opacity .15s",
                    }}
                  >
                    {/* Card head: code (mono) + cut date */}
                    <div className="flex items-center justify-between">
                      <span
                        className="font-mono text-[color:var(--orion-ink-3)]"
                        style={{ fontSize: 11.5 }}
                      >
                        {shortId(c.id)}
                      </span>
                      <span
                        className="text-[11px] text-[color:var(--orion-ink-3)]"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {formatCutDate(c.cut_at)}
                      </span>
                    </div>

                    {/* Product name in display font, 15px */}
                    <div
                      className="font-serif text-[color:var(--orion-ink)]"
                      style={{ fontSize: 15, marginTop: 4, lineHeight: 1.15 }}
                    >
                      {c.product.name}
                    </div>

                    {/* Fabric/roll row: small swatch + body_roll code + counts */}
                    <div
                      className="flex items-center gap-2 text-[color:var(--orion-ink-3)]"
                      style={{ marginTop: 10, fontSize: 11.5 }}
                    >
                      <span
                        aria-hidden
                        // FabricThumb tone=warm equivalent — 20×20 woven
                        // gradient block matching the design's repeating
                        // linear-gradient diagonal stripes.
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
                        {c.body_roll.code}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
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
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
