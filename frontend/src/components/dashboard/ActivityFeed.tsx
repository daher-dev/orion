"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { ActivityItem } from "@/lib/schemas/dashboard";

type Props = { items: ActivityItem[] };

function formatRelative(date: Date, now: Date, locale: string): string {
  const diff = Math.round((now.getTime() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diff < 60) return rtf.format(-diff, "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  return rtf.format(-Math.round(diff / 86400), "day");
}

/**
 * "Atividade recente" card — direct port of the second-column
 * `<Card title="Atividade recente" pad={false}>` block from
 * /docs/design/source/pages/dashboard.jsx.
 *
 * Layout:
 *  - .card shell + .card-head (title + count sub + ghost "Auditoria" action
 *    with arrow-right glyph).
 *  - Rows are 10px 18px padding, line-soft border between them.
 *  - Each row leads with a 6px accent-coloured dot (margin-top 7 for optical
 *    centering), then 13px text — the design wraps `<span>` tags in different
 *    inks (ink for who/target, ink-3 for the verb).
 *  - Timestamp is 11px ink-3, whitespace-nowrap, right-aligned.
 */
export function ActivityFeed({ items }: Props) {
  const t = useTranslations("dashboard.activity");
  const locale = useLocale();
  const now = new Date();

  return (
    <section className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub", { count: items.length })}
          </div>
        </div>
        <Link
          href="/settings/audit"
          className="inline-flex items-center gap-1 rounded-[5px] px-[9px] py-[4px] text-[12px] font-medium text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
        >
          {t("auditLink")}
          <ArrowRight size={12} strokeWidth={1.8} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-[18px] py-[28px] text-center text-[13px] text-[color:var(--orion-ink-3)]">
          {t("empty")}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0 py-[4px]">
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            return (
              <li
                key={item.id}
                className={
                  "flex items-start gap-[10px] px-[18px] py-[10px] " +
                  (isLast
                    ? ""
                    : "border-b border-[color:var(--orion-line-soft)]")
                }
              >
                {/* 6×6 dot, Ember accent coloured. mt 7 for optical
                    centering against the first text line. */}
                <span
                  aria-hidden
                  className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-[color:var(--sidebar-primary)]"
                />
                <div className="min-w-0 flex-1 text-[13px]">
                  {item.who ? (
                    <>
                      <span className="font-medium text-[color:var(--orion-ink)]">
                        {item.who}
                      </span>{" "}
                    </>
                  ) : null}
                  <span className="text-[color:var(--orion-ink-3)]">
                    {item.message}
                  </span>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-[color:var(--orion-ink-3)]">
                  {formatRelative(new Date(item.when), now, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
