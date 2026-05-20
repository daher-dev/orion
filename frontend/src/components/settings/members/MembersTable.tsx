"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MemberRead } from "@/lib/schemas/member";

const avBg = (id: string) => {
  const palette = [
    "var(--brand-settings)",
    "var(--brand-prod)",
    "var(--brand-catalog)",
    "var(--brand-reports)",
    "var(--brand-inv)",
  ];
  const last = id.length > 0 ? id.charCodeAt(id.length - 1) : 0;
  return palette[last % palette.length];
};

function Avatar({ name, id }: { name: string; id: string }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-grid h-7 w-7 place-items-center rounded-full font-serif text-[11px] font-semibold text-white"
      style={{ background: avBg(id) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export type MembersTableProps = {
  rows: MemberRead[];
  onView: (member: MemberRead) => void;
};

export function MembersTable({ rows, onView }: MembersTableProps) {
  const t = useTranslations("members");
  const locale = useLocale();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    [locale],
  );

  return (
    <table
      className="w-full border-separate border-spacing-0 text-[13px]"
      data-testid="members-table"
    >
      <thead>
        <tr>
          {(
            [
              ["name", "name"],
              ["email", "email"],
              ["role", "role"],
              ["joinedAt", "joinedAt"],
              ["chevron", null],
            ] as const
          ).map(([id, key]) => (
            <th
              key={id}
              className={`border-b border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-[14px] py-[10px] text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)] ${
                id === "chevron" ? "w-[36px] text-right" : ""
              }`}
            >
              {key ? t(`table.columns.${key}`) : <span className="sr-only">·</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((member, idx) => (
          <tr
            key={member.id}
            data-testid="members-row"
            data-member-id={member.id}
            onClick={() => onView(member)}
            className="cursor-pointer hover:[&_td]:bg-[color:var(--orion-bg)]"
          >
            <td
              className={`px-[14px] py-[12px] align-middle ${
                idx < rows.length - 1
                  ? "border-b border-[color:var(--orion-line-soft)]"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Avatar name={member.name} id={member.id} />
                <span className="font-medium text-[color:var(--orion-ink)]">
                  {member.name}
                </span>
              </div>
            </td>
            <td
              className={`px-[14px] py-[12px] align-middle font-mono text-[12px] text-[color:var(--orion-ink)] ${
                idx < rows.length - 1
                  ? "border-b border-[color:var(--orion-line-soft)]"
                  : ""
              }`}
            >
              {member.email}
            </td>
            <td
              className={`px-[14px] py-[12px] align-middle text-[color:var(--orion-ink-2)] ${
                idx < rows.length - 1
                  ? "border-b border-[color:var(--orion-line-soft)]"
                  : ""
              }`}
            >
              {member.role.name}
            </td>
            <td
              className={`px-[14px] py-[12px] align-middle text-[12px] text-[color:var(--orion-ink-3)] ${
                idx < rows.length - 1
                  ? "border-b border-[color:var(--orion-line-soft)]"
                  : ""
              }`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {dateFormatter.format(new Date(member.created_at))}
            </td>
            <td
              className={`px-[14px] py-[12px] align-middle text-right ${
                idx < rows.length - 1
                  ? "border-b border-[color:var(--orion-line-soft)]"
                  : ""
              }`}
            >
              <ChevronRight
                aria-hidden
                className="size-3.5 text-[color:var(--orion-ink-3)]"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
