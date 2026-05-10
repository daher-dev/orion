"use client";

import { Layers, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate?: () => void;
};

export function FabricRollsEmptyState({ onCreate }: Props) {
  const t = useTranslations("fabric.list.empty");

  return (
    <div
      data-testid="fabric-empty-state"
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
        <Layers size={24} strokeWidth={1.6} />
      </div>
      <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">{t("title")}</h3>
      <p className="mx-auto mb-3 max-w-[360px] text-[13px] leading-[1.5]">{t("body")}</p>
      {onCreate ? (
        <Button
          onClick={onCreate}
          className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-inv)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:bg-[color-mix(in_oklab,var(--brand-inv)_88%,black)]"
          style={{ borderColor: "color-mix(in oklab, var(--brand-inv) 70%, black)" }}
        >
          <Plus size={14} strokeWidth={2.2} />
          {t("cta")}
        </Button>
      ) : null}
    </div>
  );
}
