"use client";

import { useState, type DragEvent, type ReactNode } from "react";

/**
 * Generic drag-and-drop Kanban board — extracted from `CuttingKanban` so the
 * Corte, Impressão (and future) boards share one column shell + drag mechanics.
 *
 * Domain-agnostic: the consumer supplies the columns, the items, how to read an
 * item's column id, how to render a card, and a move handler. The board owns the
 * drag state, the dashed-over column styling, and the stable `data-testid`s
 * (`{testidPrefix}`, `-col-${id}`, `-card`) so existing e2e selectors hold.
 *
 * Drag is gated by `canMove` (defaults to true). Cards remain clickable
 * regardless via the consumer's own `renderCard` handlers.
 */

export type KanbanColumn = {
  id: string;
  label: ReactNode;
  /** Optional explicit count badge; defaults to the column's item count. */
  count?: number;
};

type Props<T> = {
  columns: KanbanColumn[];
  items: T[];
  /** Which column an item belongs to. */
  getColumnId: (item: T) => string;
  /** Stable key for an item (used for React keys + drag identity). */
  getItemId: (item: T) => string;
  /** Fired when a card is dropped onto a different column. */
  onMove: (item: T, targetColumnId: string) => void;
  /** Render the card body; the board wraps it with drag handlers + chrome. */
  renderCard: (item: T) => ReactNode;
  /** Render optional header trailing content for a column (e.g. a + button). */
  renderColumnAction?: (columnId: string) => ReactNode;
  /** When false, cards are not draggable (read-only viewers). */
  canMove?: boolean;
  /** Accent colour for the drag-over state. */
  accent?: string;
  /** data-testid prefix; the board appends `-col-${id}` and `-card`. */
  testidPrefix: string;
};

export function KanbanBoard<T>({
  columns,
  items,
  getColumnId,
  getItemId,
  onMove,
  renderCard,
  renderColumnAction,
  canMove = true,
  accent = "var(--brand-prod)",
  testidPrefix,
}: Props<T>) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const columnBgOver = `color-mix(in oklab, ${accent} 6%, var(--orion-surface))`;

  function handleDrop(targetColumnId: string) {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const dragged = items.find((it) => getItemId(it) === id);
    if (!dragged || getColumnId(dragged) === targetColumnId) return;
    onMove(dragged, targetColumnId);
  }

  return (
    <div
      data-testid={testidPrefix}
      className="grid gap-[14px]"
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      {columns.map((col) => {
        const colItems = items.filter((it) => getColumnId(it) === col.id);
        const isOver = overCol === col.id;
        const count = col.count ?? colItems.length;
        return (
          <div
            key={col.id}
            data-testid={`${testidPrefix}-col-${col.id}`}
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
              handleDrop(col.id);
            }}
            style={{
              background: isOver ? columnBgOver : "var(--orion-surface)",
              border: `1px ${isOver ? "dashed" : "solid"} ${isOver ? accent : "var(--orion-line)"}`,
              borderRadius: "var(--radius-lg)",
              padding: 12,
              transition: "background .15s, border-color .15s",
            }}
          >
            <div className="flex items-center justify-between" style={{ padding: "4px 6px 10px" }}>
              <div className="flex items-center gap-1.5">
                {col.label}
                <span
                  className="text-[11px] text-[color:var(--orion-ink-3)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {count}
                </span>
              </div>
              {renderColumnAction?.(col.id)}
            </div>

            {/* Empty columns keep a 40px min-height so the drop target stays
                usable when dragging across. */}
            <div className="grid gap-2" style={{ minHeight: 40 }}>
              {colItems.map((item) => {
                const id = getItemId(item);
                const isDragging = dragId === id;
                return (
                  <div
                    key={id}
                    data-testid={`${testidPrefix}-card`}
                    draggable={canMove}
                    onDragStart={(e) => {
                      setDragId(id);
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    style={{
                      opacity: isDragging ? 0.4 : 1,
                      cursor: canMove ? "grab" : "pointer",
                      transition: "opacity .15s",
                    }}
                  >
                    {renderCard(item)}
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
