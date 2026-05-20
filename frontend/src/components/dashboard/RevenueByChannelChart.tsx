"use client";

import { useLocale, useTranslations } from "next-intl";
import { CHANNEL_THEME } from "@/components/ads/AdsGrid";
import type { ChannelRevenue } from "@/lib/schemas/dashboard";
import type { Ecommerce } from "@/lib/schemas/ad";

type Props = {
  items: ChannelRevenue[];
};

/**
 * "Receita por canal" card — direct port of the `<Card title="Receita por
 * canal" sub="Últimos 30 dias">` block + `<ChannelBars/>` in
 * /docs/design/source/pages/dashboard.jsx.
 *
 * Each row uses a `grid-template-columns: 160px 1fr 80px` layout with 12px
 * gap: ChannelChip on the left, a 10px-tall pill-shaped bar in the middle
 * (track bg `--orion-bg`, foreground the channel's brand color, both with
 * border-radius 999), and the monetary value mono on the right.
 *
 * The channel chip mirrors the design's `.ch-chip` — a 16×16 colored dot with
 * the channel's 2-letter short label, followed by the channel display name.
 */
export function RevenueByChannelChart({ items }: Props) {
  const t = useTranslations("dashboard.revenueByChannel");
  const tChannels = useTranslations("orders.channels");
  const locale = useLocale();

  const currency = new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: locale === "pt-BR" ? "BRL" : "USD",
    maximumFractionDigits: 0,
  });

  // Sort descending by revenue so the largest bar is on top — matches the
  // visual sort order in the design source (where the seed data is already
  // sorted).
  const sortedItems = [...items].sort((a, b) => b.revenue - a.revenue);
  const max = Math.max(...sortedItems.map((i) => i.revenue), 1);

  return (
    <section
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="revenue-by-channel"
    >
      {/* .card-head — same shape as the other cards on the dashboard. */}
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub")}
          </div>
        </div>
      </div>

      {/* `pad=true` body — 14 18 18 from the design source. */}
      {sortedItems.length === 0 ? (
        <div className="px-[18px] py-[28px] text-center text-[13px] text-[color:var(--orion-ink-3)]">
          {t("empty")}
        </div>
      ) : (
        <div className="grid gap-[14px] px-[18px] pt-[14px] pb-[18px]">
          {sortedItems.map((item) => {
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
              <div
                key={item.channel}
                className="grid items-center gap-3"
                style={{ gridTemplateColumns: "160px 1fr 80px" }}
              >
                {/* .ch-chip — pill with 16×16 coloured dot + name. */}
                <span className="inline-flex items-center gap-[6px] rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] py-[2px] pl-[4px] pr-[7px] text-[11.5px] font-medium text-[color:var(--orion-ink)]">
                  <span
                    aria-hidden
                    className="grid h-4 w-4 place-items-center rounded-full text-[8.5px] font-bold"
                    style={{ background: theme.color, color: theme.fg }}
                  >
                    {theme.short}
                  </span>
                  {channelLabel}
                </span>
                {/* 10px-tall track bar. The fill uses the channel's brand
                    colour rendered at full opacity (the design holds opacity
                    at 1, the dampening is built into the channel colours). */}
                <div
                  className="relative overflow-hidden rounded-full"
                  style={{ height: 10, background: "var(--orion-bg)" }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${pct}%`, background: theme.color }}
                  />
                </div>
                <span
                  className="text-right font-mono text-[12px] text-[color:var(--orion-ink)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {currency.format(item.revenue)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
