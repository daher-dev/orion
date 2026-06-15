"use client";

import { ArrowUpRight, CheckCircle2, ClipboardCheck, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Selection summary + create action — port of the prototype `planejamento.jsx`
 * action bar + success banner. Shows "{N} cuts · {M} prints selected", a primary
 * "Criar N ordens" button (disabled when nothing is selected or while creating),
 * an optional "Ver no Corte" link after a create, and the created-codes banner.
 */
type Props = {
  cortesSelected: number;
  impressoesSelected: number;
  total: number;
  disabled?: boolean;
  isPending?: boolean;
  createdCodes?: string[] | null;
  onCreate: () => void;
  onViewCutting?: () => void;
};

const PRIMARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-prod)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:cursor-default disabled:opacity-50";

const SECONDARY_BUTTON_CLASS =
  "h-auto gap-[7px] rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]";

export function PlanningActionBar({
  cortesSelected,
  impressoesSelected,
  total,
  disabled,
  isPending,
  createdCodes,
  onCreate,
  onViewCutting,
}: Props) {
  const t = useTranslations("planning");
  const canCreate = total > 0 && !disabled && !isPending;

  return (
    <>
      <div
        className="mt-3.5 flex flex-wrap items-center gap-4 rounded-[14px] border px-[18px] py-3"
        style={{
          background: canCreate
            ? "color-mix(in oklab, var(--brand-prod) 6%, var(--orion-surface))"
            : "var(--orion-surface)",
          borderColor: canCreate
            ? "color-mix(in oklab, var(--brand-prod) 24%, var(--orion-surface))"
            : "var(--orion-line)",
        }}
      >
        <ClipboardCheck size={18} className="flex-shrink-0" style={{ color: "var(--brand-prod)" }} />
        <span className="text-[13px] text-[color:var(--orion-ink-2)]" data-testid="planning-selection-summary">
          {t("actionbar.selected", { cortes: cortesSelected, impressoes: impressoesSelected })}
        </span>
        <span className="ml-auto flex flex-shrink-0 gap-2.5">
          {createdCodes && onViewCutting ? (
            <Button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onViewCutting}>
              <ArrowUpRight size={13} strokeWidth={1.8} />
              {t("actions.viewCutting")}
            </Button>
          ) : null}
          <Button
            type="button"
            data-testid="planning-create-button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={!canCreate}
            onClick={onCreate}
          >
            <Plus size={14} strokeWidth={1.8} />
            {t("actions.create", { n: total })}
          </Button>
        </span>
      </div>

      {createdCodes ? (
        <div
          data-testid="planning-created-banner"
          className="mt-3.5 flex items-center gap-2.5 rounded-[10px] border px-4 py-3 text-[13px]"
          style={{
            background: "color-mix(in oklab, var(--status-ok) 9%, var(--orion-surface))",
            borderColor: "color-mix(in oklab, var(--status-ok) 22%, var(--orion-surface))",
            color: "var(--status-ok)",
          }}
        >
          <CheckCircle2 size={16} className="flex-shrink-0" />
          <span>
            {t("created.banner")}
            {createdCodes.length ? ` · ${createdCodes.join(", ")}` : ""}
          </span>
        </div>
      ) : null}
    </>
  );
}
