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

export function ActivityFeed({ items }: Props) {
  const t = useTranslations("dashboard.activity");
  const locale = useLocale();
  const now = new Date();

  if (items.length === 0) {
    return (
      <section className="flex h-full flex-col gap-2 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5">
        <h2 className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t("title")}
        </h2>
        <p className="text-[13px] text-[color:var(--orion-ink-3)]">{t("empty")}</p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
          {t("title")}
        </h2>
        <Link
          href="/settings/audit"
          className="flex items-center gap-1 text-[11.5px] font-medium text-[color:var(--orion-ink-3)] hover:text-[color:var(--orion-ink)]"
        >
          {t("auditLink")}
          <ArrowRight size={11} strokeWidth={2} />
        </Link>
      </div>
      <ul className="m-0 flex max-h-[420px] list-none flex-col gap-2 overflow-y-auto p-0">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-0.5 border-b border-[color:var(--orion-line-soft)] pb-2 last:border-b-0 last:pb-0"
          >
            <span className="text-[13px] text-[color:var(--orion-ink-2)]">{item.message}</span>
            <span className="text-[11px] text-[color:var(--orion-ink-3)]">
              {item.who ?? t("system")} · {formatRelative(new Date(item.when), now, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
