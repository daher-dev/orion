import type { ReactNode } from "react";

/**
 * 2-up KPI strip — generalised from the prototype `InventoryKpis`. Each item
 * shows a label, a large display-font value (optionally tinted), an optional
 * unit suffix and an optional hint line.
 */
export type InventoryKpiItem = {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  hint?: ReactNode;
  /** CSS var/hex tinting the value (e.g. amber when below minimum). */
  tone?: string;
};

type Props = {
  items: InventoryKpiItem[];
};

export function InventoryKpis({ items }: Props) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2" data-testid="inventory-kpis">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[18px] py-[16px]"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
            {item.label}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className="font-serif text-[28px] leading-none tabular-nums"
              style={{ color: item.tone ?? "var(--orion-ink)" }}
            >
              {item.value}
            </span>
            {item.unit ? (
              <span className="text-[12px] text-[color:var(--orion-ink-3)]">{item.unit}</span>
            ) : null}
          </div>
          {item.hint ? (
            <div className="mt-1 text-[11px] text-[color:var(--orion-ink-3)]">{item.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
