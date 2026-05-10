"use client";

import { Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Empty state — direct port of design's `.empty`:
 *   padding 56 24, text-center, ink-3 body.
 *   .empty-mark: 56×56 rounded-14, surface-2 bg, ink-3, mb 12.
 *   h3: 17px ink, mb 6.
 *   body: 13px lh 1.5, max-w 360, centered, mb 12.
 */
export function ClientsEmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useTranslations("clients.list.empty");
  return (
    <div className="px-6 py-14 text-center text-[color:var(--orion-ink-3)]">
      <div className="mb-3 inline-grid h-14 w-14 place-items-center rounded-[14px] bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-3)]">
        <Users className="size-6" strokeWidth={1.75} />
      </div>
      <h3 className="mb-1.5 font-serif text-[17px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
        {t("title")}
      </h3>
      <div className="mx-auto mb-3 max-w-[360px] text-[13px] leading-[1.5]">
        {t("body")}
      </div>
      <Button
        type="button"
        onClick={onCreate}
        className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
        style={{
          borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)",
        }}
      >
        <Users className="size-3.5" strokeWidth={1.75} />
        {t("cta")}
      </Button>
    </div>
  );
}
