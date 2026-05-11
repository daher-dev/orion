"use client";

import { useCallback, type ChangeEvent } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type {
  EditableField,
  ParsedOrderRow,
} from "@/lib/schemas/orders-import";
import { ConfidenceChip } from "./ConfidenceChip";

type Props = {
  rows: ParsedOrderRow[];
  /** Per-row commit errors keyed by `row_index`. */
  errorsByIndex?: Record<number, string>;
  /** Update a single field on a row (by row_index). */
  onUpdate: (rowIndex: number, field: EditableField, value: string) => void;
  /** Remove a row by row_index. */
  onRemove: (rowIndex: number) => void;
};

/**
 * Editable preview table — direct visual port of `.tbl` from the
 * design's `/docs/design/source/styles.css`. The first column is the
 * confidence pill (so the operator can sort visually), every other
 * column is an inline-editable shadcn `<Input>` matching the row form
 * field style.
 *
 * Per-row errors render as a red helper below the offending row.
 */
export function ImportPreviewTable({
  rows,
  errorsByIndex = {},
  onUpdate,
  onRemove,
}: Props) {
  const t = useTranslations("ordersImport.preview");

  const handleChange = useCallback(
    (rowIndex: number, field: EditableField) =>
      (event: ChangeEvent<HTMLInputElement>) =>
        onUpdate(rowIndex, field, event.target.value),
    [onUpdate],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <Th>{t("columns.rowIdx")}</Th>
            <Th>{t("columns.confidence")}</Th>
            <Th>{t("columns.clientName")}</Th>
            <Th>{t("columns.clientEmail")}</Th>
            <Th>{t("columns.clientPhone")}</Th>
            <Th>{t("columns.productHint")}</Th>
            <Th align="right">{t("columns.quantity")}</Th>
            <Th align="right">{t("columns.salePrice")}</Th>
            <Th>{t("columns.orderedAt")}</Th>
            <Th>{t("columns.rawExcerpt")}</Th>
            <Th align="right">{t("columns.actions")}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const rowError = errorsByIndex[row.row_index];
            return (
              <tr
                key={row.row_index}
                data-testid={`import-row-${row.row_index}`}
                className="hover:[&_td]:bg-[color:var(--orion-bg)]"
              >
                <Td>
                  <span className="font-mono text-[12px] text-[color:var(--orion-ink-3)]">
                    #{row.row_index + 1}
                  </span>
                </Td>
                <Td>
                  <ConfidenceChip score={row.confidence} />
                </Td>
                <Td>
                  <CellInput
                    value={row.client_name ?? ""}
                    onChange={handleChange(row.row_index, "client_name")}
                  />
                </Td>
                <Td>
                  <CellInput
                    type="email"
                    value={row.client_email ?? ""}
                    onChange={handleChange(row.row_index, "client_email")}
                  />
                </Td>
                <Td>
                  <CellInput
                    value={row.client_phone ?? ""}
                    onChange={handleChange(row.row_index, "client_phone")}
                  />
                </Td>
                <Td>
                  <CellInput
                    value={row.product_hint ?? ""}
                    onChange={handleChange(row.row_index, "product_hint")}
                  />
                </Td>
                <Td align="right">
                  <CellInput
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={row.quantity != null ? String(row.quantity) : ""}
                    onChange={handleChange(row.row_index, "quantity")}
                    className="text-right"
                  />
                </Td>
                <Td align="right">
                  <CellInput
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={0}
                    value={row.sale_price ?? ""}
                    onChange={handleChange(row.row_index, "sale_price")}
                    className="text-right"
                  />
                </Td>
                <Td>
                  <CellInput
                    type="datetime-local"
                    value={toLocalDateTime(row.ordered_at)}
                    onChange={handleChange(row.row_index, "ordered_at")}
                  />
                </Td>
                <Td>
                  <span
                    className="block max-w-[220px] truncate text-[12px] text-[color:var(--orion-ink-3)]"
                    title={row.raw_excerpt ?? ""}
                  >
                    {row.raw_excerpt ?? ""}
                  </span>
                </Td>
                <Td align="right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeRow")}
                    onClick={() => onRemove(row.row_index)}
                    className="h-8 w-8 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--status-err)]"
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                  </Button>
                </Td>
                {rowError ? (
                  <td
                    colSpan={11}
                    className="border-b border-[color:var(--orion-line-soft)] px-[14px] pb-[10px] text-[12px] text-[color:var(--status-err)]"
                  >
                    {rowError}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Helper: render a th cell with the standard design styling. */
function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`border-b border-[color:var(--orion-line-soft)] px-[14px] py-[6px] align-middle ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

type CellInputProps = React.InputHTMLAttributes<HTMLInputElement>;

function CellInput({ className = "", ...props }: CellInputProps) {
  return (
    <Input
      {...props}
      className={`h-auto rounded-[6px] border border-transparent bg-transparent px-2 py-[5px] text-[12.5px] text-[color:var(--orion-ink)] shadow-none placeholder:text-[color:var(--orion-ink-3)] hover:border-[color:var(--orion-line-soft)] focus:border-[color:var(--brand-sales)] focus-visible:ring-0 ${className}`}
    />
  );
}

/**
 * Convert an ISO timestamp to the `<input type="datetime-local">` value
 * format (YYYY-MM-DDTHH:mm). Returns an empty string if the value can't
 * be parsed so the input stays blank instead of "Invalid Date".
 */
function toLocalDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
