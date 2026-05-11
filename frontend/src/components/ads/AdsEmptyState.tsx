"use client";

import { Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate: () => void;
};

export function AdsEmptyState({ onCreate }: Props) {
  const t = useTranslations("ads.list.empty");
  return (
    <div
      className="text-center text-[color:var(--orion-ink-3)]"
      style={{ paddingTop: 56, paddingBottom: 56, paddingLeft: 24, paddingRight: 24 }}
    >
      <div
        className="mb-3 inline-grid place-items-center rounded-[14px]"
        style={{
          width: 56,
          height: 56,
          background: "color-mix(in oklab, var(--brand-sales) 12%, var(--orion-surface))",
          color: "var(--brand-sales)",
        }}
      >
        <Megaphone size={24} strokeWidth={1.6} />
      </div>
      <h3 className="mb-1.5 font-serif text-[17px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
        {t("title")}
      </h3>
      <p className="mx-auto mb-3 max-w-[360px] text-[13px] leading-[1.5]">{t("body")}</p>
      <Button
        type="button"
        onClick={onCreate}
        className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
        style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
      >
        <Megaphone size={14} strokeWidth={1.8} />
        {t("cta")}
      </Button>
    </div>
  );
}
