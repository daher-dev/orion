"use client";

import { FileText, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/Can";

/**
 * Empty state shown inside the list card when there are zero specs.
 * Mirrors `.empty` from the design source: 56×56 rounded-14 surface-2 mark,
 * a 17px serif heading, a 13px ink-3 body line, and a brand-catalog CTA.
 */
export function SpecsEmptyState() {
  const t = useTranslations("specs.list.empty");
  return (
    <div
      data-testid="specs-empty-state"
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
        <FileText size={24} strokeWidth={1.6} />
      </div>
      <h3 className="mb-1.5 text-[17px] font-medium text-[color:var(--orion-ink)]">{t("title")}</h3>
      <p className="mx-auto mb-3 max-w-[360px] text-[13px] leading-[1.5]">{t("body")}</p>
      <Can permission="specs.write">
        <Button
          asChild
          className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
          style={{ borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)" }}
        >
          <Link href="/specs/new">
            <Plus size={14} strokeWidth={2.2} /> {t("cta")}
          </Link>
        </Button>
      </Can>
    </div>
  );
}
