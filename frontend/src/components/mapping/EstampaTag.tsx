"use client";

import { Stamp } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  /** Print design code (e.g. "EST-001"); null when the product has no print. */
  code?: string | null;
  /** Print design name, used as the tag title for accessibility. */
  name?: string | null;
};

/**
 * Estampa pill — the "EstampaTag" from `docs/design/pages/lotes.jsx`. The
 * estampa follows from the matched variation's product (`Product.print_id`);
 * a product may have no print, which the design renders as a muted "no print"
 * tag rather than hiding the column.
 */
export function EstampaTag({ code, name }: Props) {
  const t = useTranslations("mapping");
  if (!code) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-2 py-[2px] text-[10.5px] text-[color:var(--orion-ink-3)]"
        data-testid="estampa-tag-none"
      >
        <Stamp size={10} />
        {t("estampa.none")}
      </span>
    );
  }
  return (
    <span
      title={name ?? code}
      data-testid="estampa-tag"
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] font-medium"
      style={{
        color: "var(--status-warn)",
        background: "color-mix(in oklab, var(--status-warn) 14%, var(--orion-surface))",
        borderColor: "color-mix(in oklab, var(--status-warn) 22%, var(--orion-surface))",
      }}
    >
      <Stamp size={10} />
      {code}
    </span>
  );
}
