"use client";

import { FileText, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/Can";

/**
 * Empty state shown inside the list card when there are zero specs.
 * Mirrors `.empty` from the design source: 56×56 rounded-14 surface-2 mark,
 * a 17px serif heading, and a 13px ink-3 body line.
 */
export function SpecsEmptyState() {
  const t = useTranslations("specs.list.empty");
  return (
    <div className="px-6 py-14 text-center text-[color:var(--orion-ink-3)]" data-testid="specs-empty-state">
      <span
        className="mb-3 inline-grid h-14 w-14 place-items-center rounded-[14px] bg-[color:var(--orion-surface-2)]"
        aria-hidden="true"
      >
        <FileText className="size-6 text-[color:var(--orion-ink-3)]" />
      </span>
      <h3 className="mb-1.5 font-serif text-[17px] font-normal text-[color:var(--orion-ink)]">{t("title")}</h3>
      <p className="mx-auto mb-4 max-w-[40ch] text-[13px] leading-[1.5]">{t("body")}</p>
      <Can permission="specs.write">
        <Button asChild size="sm">
          <Link href="/specs/new">
            <Plus className="size-3.5" /> {t("cta")}
          </Link>
        </Button>
      </Can>
    </div>
  );
}
