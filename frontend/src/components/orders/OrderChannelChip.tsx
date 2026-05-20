"use client";

import { useTranslations } from "next-intl";
import type { Ecommerce } from "@/lib/schemas/ad";
import { CHANNEL_THEME } from "@/components/ads/channel-theme";

/**
 * Channel chip mirroring `.ch-chip` from `/docs/design/source/styles.css`
 * (lines 559-569). Pill with a 16×16 rounded-full coloured square showing
 * the channel's two-letter short code, followed by the channel name.
 */
type Props = {
  channel: Ecommerce;
};

export function OrderChannelChip({ channel }: Props) {
  const t = useTranslations("orders.channels");
  const theme = CHANNEL_THEME[channel];
  return (
    <span
      data-testid={`channel-chip-${channel}`}
      // .ch-chip — surface-2 bg, line-soft border, 999 radius, 11.5px / 500.
      className="ch-chip inline-flex items-center gap-1.5 rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-1.5 py-[2px] text-[11.5px] font-medium text-[color:var(--orion-ink)] whitespace-nowrap"
    >
      {/* .ch-chip-dot — 16×16 rounded-full, channel-coloured, 8.5px 700 ink. */}
      <span
        className="ch-chip-dot inline-grid h-4 w-4 place-items-center rounded-full text-[8.5px] font-bold"
        style={{ background: theme.color, color: theme.fg }}
        aria-hidden="true"
      >
        {theme.short}
      </span>
      {t(channel)}
    </span>
  );
}
