"use client";

import { useTranslations } from "next-intl";
import type { Ecommerce } from "@/lib/schemas/ad";
import { CHANNEL_THEME } from "@/components/ads/AdsGrid";

/**
 * Channel chip mirroring `.ch-chip` from the design (a coloured square
 * with the channel's short code + the channel name). Re-uses the same
 * `CHANNEL_THEME` palette the Ads grid already exposes so the orders
 * list matches the rest of the Sales section.
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
      className="ch-chip inline-flex items-center gap-1.5 text-[12px] text-[color:var(--orion-ink-2)] whitespace-nowrap"
    >
      <span
        className="ch-chip-dot inline-grid h-[18px] w-[18px] place-items-center rounded-[4px] text-[9px] font-bold"
        style={{ background: theme.color, color: theme.fg }}
        aria-hidden="true"
      >
        {theme.short}
      </span>
      {t(channel)}
    </span>
  );
}
