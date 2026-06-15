"use client";

import { ShoppingBag, TrendingDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SuggestionSource } from "@/lib/schemas/planning";

/**
 * Why a suggestion exists — port of `SRC`/`SourceBadge` from the prototype
 * `planejamento.jsx`. `demanda` (an order needs a SKU not in finished stock) is
 * tinted with the sales brand + a shopping-bag glyph; `estoque` (a tier fell
 * below its minimum) is tinted warn + a trending-down glyph. The optional
 * `detail` renders the order count for the demand badge.
 */
const CONFIG: Record<SuggestionSource, { icon: typeof ShoppingBag; fg: string }> = {
  demanda: { icon: ShoppingBag, fg: "var(--brand-sales)" },
  estoque: { icon: TrendingDown, fg: "var(--status-warn)" },
};

type Props = {
  kind: SuggestionSource;
  detail?: string | null;
};

export function SourceBadge({ kind, detail }: Props) {
  const t = useTranslations("planning.sources");
  const { icon: Icon, fg } = CONFIG[kind];
  return (
    <span
      data-testid="planning-source-badge"
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-2 py-[2px] text-[10.5px] font-medium"
      style={{
        color: fg,
        background: `color-mix(in oklab, ${fg} 11%, var(--orion-surface))`,
        borderColor: `color-mix(in oklab, ${fg} 22%, var(--orion-surface))`,
      }}
    >
      <Icon size={10.5} strokeWidth={2} />
      {t(kind)}
      {detail ? <span className="opacity-70">· {detail}</span> : null}
    </span>
  );
}
