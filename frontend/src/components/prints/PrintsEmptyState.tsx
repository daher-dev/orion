"use client";

import { Palette } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate?: () => void;
};

export function PrintsEmptyState({ onCreate }: Props) {
  const t = useTranslations("prints.list.empty");

  return (
    <div
      data-testid="prints-empty-state"
      className="px-6 text-center text-[color:var(--orion-ink-3)]"
      style={{ paddingTop: 56, paddingBottom: 56 }}
    >
      <div
        className="mb-3 inline-grid place-items-center rounded-[14px]"
        style={{
          width: 56,
          height: 56,
          background: "var(--orion-surface-2)",
          color: "var(--orion-ink-3)",
        }}
      >
        <Palette size={24} strokeWidth={1.6} />
      </div>
      <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">{t("title")}</h3>
      <p className="mx-auto mb-3 max-w-[360px] text-[13px] leading-[1.5]">{t("body")}</p>
      {onCreate ? (
        <Button
          onClick={onCreate}
          className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
          style={{ borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)" }}
        >
          <Palette size={14} strokeWidth={1.8} />
          {t("cta")}
        </Button>
      ) : null}
    </div>
  );
}
