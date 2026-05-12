"use client";

import { useLocale, useTranslations } from "next-intl";
import { CHANNEL_THEME } from "@/components/ads/AdsGrid";
import type { ChannelRevenue } from "@/lib/schemas/dashboard";
import type { Ecommerce } from "@/lib/schemas/ad";

type Props = {
  items: ChannelRevenue[];
};

export function RevenueByChannelChart({ items }: Props) {
  const t = useTranslations("dashboard.revenueByChannel");
  const tChannels = useTranslations("orders.channels");
  const locale = useLocale();

  const currency = new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: locale === "pt-BR" ? "BRL" : "USD",
    maximumFractionDigits: 0,
  });

  const max = Math.max(...items.map((i) => i.revenue), 1);

  if (items.length === 0) {
    return (
      <section
        className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5"
        data-testid="revenue-by-channel"
      >
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
          {t("title")}
        </h2>
        <p className="text-[13px] text-[color:var(--orion-ink-3)]">{t("empty")}</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5"
      data-testid="revenue-by-channel"
    >
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {t("title")}
      </h2>
      <ol className="flex flex-col gap-3">
        {items.map((item) => {
          const theme = CHANNEL_THEME[item.channel as Ecommerce] ?? {
            color: "var(--orion-ink-3)",
            fg: "#fff",
            short: "??",
          };
          const pct = (item.revenue / max) * 100;
          const channelLabel = (() => {
            try {
              return tChannels(item.channel as Parameters<typeof tChannels>[0]);
            } catch {
              return item.channel;
            }
          })();
          return (
            <li key={item.channel} className="flex items-center gap-3">
              <span
                className="inline-grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] text-[9px] font-bold"
                style={{ background: theme.color, color: theme.fg }}
                aria-hidden="true"
              >
                {theme.short}
              </span>
              <span className="w-[100px] shrink-0 text-[12px] text-[color:var(--orion-ink-2)]">
                {channelLabel}
              </span>
              <div
                className="relative flex-1 rounded-full"
                style={{ height: 6, background: "var(--orion-line-soft)" }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: theme.color,
                    opacity: 0.85,
                  }}
                />
              </div>
              <span
                className="w-[80px] shrink-0 text-right text-[12px] font-medium text-[color:var(--orion-ink)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {currency.format(item.revenue)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
