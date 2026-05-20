import type { Ecommerce } from "@/lib/schemas/ad";

/**
 * Channel theming — direct port of design's `ORION_DATA.channels`
 * (see /docs/design/source/data.js) with the addition of `mercado_livre`
 * and `other` for the F-012 wire shape. Mercado Livre's yellow needs a
 * dark foreground for contrast against its primary brand color.
 */
export type ChannelTheme = {
  color: string;
  fg: string;
  short: string;
};

export const CHANNEL_THEME: Record<Ecommerce, ChannelTheme> = {
  shopee: { color: "#ee4d2d", fg: "#ffffff", short: "SH" },
  mercado_livre: { color: "#fff159", fg: "#1f1f1f", short: "ML" },
  shopify: { color: "#95bf47", fg: "#ffffff", short: "SP" },
  instagram: { color: "#e4405f", fg: "#ffffff", short: "IG" },
  whatsapp: { color: "#25d366", fg: "#ffffff", short: "WA" },
  other: { color: "var(--orion-ink-3)", fg: "#ffffff", short: "··" },
};
