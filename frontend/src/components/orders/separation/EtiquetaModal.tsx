"use client";

import { ClipboardList, Printer, Settings, Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EtiquetaCard } from "@/components/orders/separation/EtiquetaCard";
import { printSeparationLabels } from "@/lib/print-separation-labels";
import type { SeparationLabel } from "@/lib/schemas/separation";

/**
 * Etiqueta print modal — port of the design's `EtiquetaModal`
 * (`/docs/design/pages/separacao.jsx`). Shows a 100×50mm preview of the first
 * label, prints all labels via `printSeparationLabels`, and surfaces the
 * Chrome print caveat (paper 100×50mm, margins None, scale 100%).
 */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: SeparationLabel[];
  /** Called after the print dialog is triggered (close + invalidate). */
  onPrinted?: () => void;
};

export function EtiquetaModal({ open, onOpenChange, labels, onPrinted }: Props) {
  const t = useTranslations("separation.etiqueta");
  const n = labels.length;
  const first = labels[0];

  const handlePrint = () => {
    printSeparationLabels(labels);
    onPrinted?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-[11px]">
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[9px] bg-[color:var(--accent-soft,var(--orion-surface-2))] text-[color:var(--accent,var(--brand-sales))]">
                <Tag size={16} />
              </span>
              <span>
                <span className="block font-serif text-[17px] leading-[1.15]">
                  {t("title")}
                </span>
                <span className="mt-px block text-[12px] font-normal text-[color:var(--orion-ink-3)]">
                  {t("subtitle", { count: n })}
                </span>
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
          {t("previewLabel")}
        </div>
        <div className="mb-4 grid place-items-center rounded-[12px] bg-[color:var(--orion-surface-2)] p-[22px]">
          {first ? (
            <EtiquetaCard label={first} />
          ) : (
            <div className="p-8 text-[13px] text-[color:var(--orion-ink-3)]">
              {t("empty")}
            </div>
          )}
        </div>

        <div className="rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface-2)] px-4 py-3.5 text-[12.5px] leading-[1.6] text-[color:var(--orion-ink-2)]">
          <div className="mb-[7px] flex items-center gap-[7px] font-semibold text-[color:var(--orion-ink)]">
            <ClipboardList size={14} /> {t("howto.title")}
          </div>
          <div className="mb-[5px]">
            <b className="font-semibold">1)</b> {t("howto.step1")}
          </div>
          <div className="mb-[7px]">
            <b className="font-semibold">2)</b> {t("howto.step2")}
          </div>
          <div className="flex gap-[7px]">
            <Settings size={13} className="mt-0.5 flex-shrink-0" />
            <span>{t("howto.chrome")}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" disabled={n === 0} onClick={handlePrint}>
            <Printer size={14} />
            {t("print", { count: n })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
