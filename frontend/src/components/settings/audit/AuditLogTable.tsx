"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ResourceTypeChip } from "@/components/settings/audit/ResourceTypeChip";
import type { AuditLogRead } from "@/lib/schemas/audit-log";

/**
 * Table mirroring `.tbl` from `/docs/design/source/styles.css`:
 *
 *   - thead th: 10.5px uppercase tracking .08em weight 600 ink-3,
 *     padding 10 14, border-b 1px line, bg = page bg.
 *   - tbody td: 12 14 padding, border-b 1px line-soft, ink-2,
 *     vertical mid.
 *   - last row: no border bottom.
 *
 * Columns (left → right): When · Who · Resource (chip) · Target id ·
 * Detail.  The When cell shows a localised relative timestamp and ships
 * the absolute ISO via `title` for hover-precision.
 */

export type AuditLogTableProps = {
  rows: AuditLogRead[];
};

const SHORT_ID_LEN = 8;

export function AuditLogTable({ rows }: AuditLogTableProps) {
  const t = useTranslations("audit");
  const locale = useLocale();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  return (
    <table className="w-full border-separate border-spacing-0 text-[13px]" data-testid="audit-table">
      <thead>
        <tr>
          <Th>{t("table.columns.when")}</Th>
          <Th>{t("table.columns.who")}</Th>
          <Th>{t("table.columns.resourceType")}</Th>
          <Th>{t("table.columns.resourceId")}</Th>
          <Th>{t("table.columns.message")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx, arr) => {
          const isLast = idx === arr.length - 1;
          const date = new Date(row.created_at);
          return (
            <tr
              key={row.id}
              className="group/audit-row hover:[&_td]:bg-[color:var(--orion-bg)]"
              data-testid="audit-row"
            >
              {/* When — relative on the cell, absolute on hover. */}
              <Td last={isLast} className="text-[12px] text-[color:var(--orion-ink-3)]">
                <span title={date.toISOString()}>
                  {formatRelative(date, t)} · {dateFormatter.format(date)}
                </span>
              </Td>

              {/* Who — name or em-dash for system / deleted authors. */}
              <Td last={isLast}>
                {row.user ? (
                  <span className="font-medium text-[color:var(--orion-ink)]">
                    {row.user.name}
                  </span>
                ) : (
                  <span className="italic text-[color:var(--orion-ink-3)]">
                    {t("table.system")}
                  </span>
                )}
              </Td>

              {/* Resource type chip. */}
              <Td last={isLast}>
                <ResourceTypeChip resourceType={row.resource_type} />
              </Td>

              {/* Resource id — mono, shortened to first 8 chars + ellipsis,
                  full id available on hover via title. */}
              <Td
                last={isLast}
                className="font-mono text-[12px] text-[color:var(--orion-ink)]"
              >
                <span title={row.resource_id}>{shortId(row.resource_id)}</span>
              </Td>

              {/* Detail. */}
              <Td last={isLast} className="text-[color:var(--orion-ink-2)]">
                {row.message}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  // .tbl th — 10.5px uppercase tracking .08em weight 600 ink-3,
  // padding 10 14, border-b 1px line, bg page bg.
  return (
    <th
      scope="col"
      className="border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]"
    >
      {children}
    </th>
  );
}

function Td({
  children,
  last,
  className = "",
}: {
  children: React.ReactNode;
  last: boolean;
  className?: string;
}) {
  // .tbl td — 12 14 padding, border-b 1px line-soft, ink-2, vertical mid.
  // Last-child rows drop the bottom border.
  const borderCls = last ? "" : "border-b border-[color:var(--orion-line-soft)]";
  return (
    <td className={`px-[14px] py-[12px] align-middle ${borderCls} ${className}`}>
      {children}
    </td>
  );
}

/** Truncate a UUID to its first chunk for the table's "Target" column. */
function shortId(id: string): string {
  return id.length > SHORT_ID_LEN ? `${id.slice(0, SHORT_ID_LEN)}…` : id;
}

/** Render a localised relative-time string ("2h ago" / "há 2h"). */
export function formatRelative(
  date: Date,
  t: ReturnType<typeof useTranslations>,
): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.max(0, Math.round(diffMs / 1000));
  if (seconds < 5) return t("relativeTime.justNow");
  if (seconds < 60) return t("relativeTime.secondsAgo", { n: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("relativeTime.minutesAgo", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("relativeTime.hoursAgo", { n: hours });
  const days = Math.round(hours / 24);
  return t("relativeTime.daysAgo", { n: days });
}
