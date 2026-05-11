"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CommitOrderError } from "@/lib/schemas/orders-import";

type Props = {
  errors: CommitOrderError[];
};

/**
 * Post-commit error list — rendered beside (or below) the preview
 * table when /commit returns at least one per-row failure. The user
 * keeps their edits intact and can fix the offending row(s) before
 * retrying the commit.
 */
export function ImportErrorList({ errors }: Props) {
  const t = useTranslations("ordersImport.errors");
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      data-testid="import-error-list"
      className="flex flex-col gap-2 rounded-[14px] border px-4 py-3"
      style={{
        background:
          "color-mix(in oklab, var(--status-err) 8%, var(--orion-surface))",
        borderColor:
          "color-mix(in oklab, var(--status-err) 25%, var(--orion-surface))",
        color: "var(--status-err)",
      }}
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <AlertTriangle size={14} strokeWidth={2} />
        {t("generic")}
      </div>
      <ul className="flex flex-col gap-1 pl-5 text-[12.5px] leading-[1.5]">
        {errors.map((error) => (
          <li key={error.row_index} className="list-disc">
            {t("rowFailed", {
              index: error.row_index + 1,
              message: error.message,
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
