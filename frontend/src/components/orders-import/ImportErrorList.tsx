"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UpsellerImportError } from "@/lib/schemas/orders-import";

/** Cap the rendered rows — a full export can have hundreds of misses. */
const MAX_VISIBLE = 100;

type Props = {
  errors: UpsellerImportError[];
};

/**
 * Unmatched-lines table for the dry-run preview. Each line here failed
 * strict matching (no single ad/variation, or an ambiguous match) and
 * will be skipped on import. The user fixes the catalog and re-imports —
 * already-created orders are kept (the import is idempotent).
 */
export function ImportErrorList({ errors }: Props) {
  const t = useTranslations("ordersImport.unmatched");
  if (errors.length === 0) return null;

  const visible = errors.slice(0, MAX_VISIBLE);
  const overflow = errors.length - visible.length;

  return (
    <div
      role="alert"
      data-testid="import-unmatched"
      className="overflow-hidden rounded-[14px] border"
      style={{
        borderColor: "color-mix(in oklab, var(--status-err) 25%, var(--orion-line))",
      }}
    >
      <div
        className="flex flex-col gap-0.5 border-b px-4 py-3"
        style={{
          borderColor: "color-mix(in oklab, var(--status-err) 18%, var(--orion-line-soft))",
          background: "color-mix(in oklab, var(--status-err) 6%, var(--orion-surface))",
        }}
      >
        <div
          className="flex items-center gap-2 text-[13px] font-semibold"
          style={{ color: "var(--status-err)" }}
        >
          <AlertTriangle size={14} strokeWidth={2} />
          {t("title")} · {errors.length}
        </div>
        <p className="text-[11.5px] leading-[1.5] text-[color:var(--orion-ink-3)]">
          {t("sub")}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[color:var(--orion-ink-3)]">
              <th className="px-4 py-2 font-medium">{t("columns.row")}</th>
              <th className="px-4 py-2 font-medium">{t("columns.order")}</th>
              <th className="px-4 py-2 font-medium">{t("columns.sku")}</th>
              <th className="px-4 py-2 font-medium">{t("columns.reason")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((error) => (
              <tr
                key={error.row_index}
                className="border-t border-[color:var(--orion-line-soft)]"
              >
                <td className="px-4 py-2 tabular-nums text-[color:var(--orion-ink-3)]">
                  {error.row_index + 1}
                </td>
                <td className="px-4 py-2 text-[color:var(--orion-ink-2)]">
                  {error.platform_order_id ?? "—"}
                </td>
                <td className="px-4 py-2 font-mono text-[11.5px] text-[color:var(--orion-ink-2)]">
                  {error.sku ?? "—"}
                </td>
                <td className="px-4 py-2 text-[color:var(--orion-ink)]">
                  {error.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overflow > 0 ? (
        <div className="border-t border-[color:var(--orion-line-soft)] px-4 py-2 text-[11.5px] text-[color:var(--orion-ink-3)]">
          {t("more", { count: overflow })}
        </div>
      ) : null}
    </div>
  );
}
