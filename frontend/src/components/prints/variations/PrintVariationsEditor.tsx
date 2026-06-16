"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useCreateVariation,
  useDeleteVariation,
  useUpdatePrint,
  useUploadArtwork,
} from "@/hooks/use-prints";
import { useCatalogConfig } from "@/hooks/use-catalog-config";
import type { Print, PrintSide, PrintVariation } from "@/lib/schemas/print";
import { InkChip } from "./InkChip";
import { SidePngTile } from "./SidePngTile";
import { SidesSelector } from "./SidesSelector";

type Props = {
  print: Print;
  canWrite: boolean;
};

/** Which sides this print uses, in front→back order. */
function activeSides(print: Print): PrintSide[] {
  const sides: PrintSide[] = [];
  if (print.has_front) sides.push("front");
  if (print.has_back) sides.push("back");
  return sides.length ? sides : ["front"];
}

/** A variation is ready when every active side has an uploaded PNG. */
function pendingSides(print: Print, v: PrintVariation): number {
  return activeSides(print).filter((s) =>
    s === "front" ? v.front_status !== "ok" : v.back_status !== "ok",
  ).length;
}

/**
 * Color variations + per-side PNG manager for an estampa. Sides are a
 * print-level property (`has_front`/`has_back`); each color variation carries
 * one PNG per active side, uploaded for real via the multipart artwork
 * endpoint. Source: docs/design/pages/catalog.jsx (PrintDetail variations).
 */
export function PrintVariationsEditor({ print, canWrite }: Props) {
  const t = useTranslations("prints.variations");
  const tSides = useTranslations("prints.sides");
  const printId = print.id;

  const { data: catalog } = useCatalogConfig();
  const printColors = catalog?.config.printColors ?? [];

  const updatePrint = useUpdatePrint();
  const createVariation = useCreateVariation(printId);
  const deleteVariation = useDeleteVariation(printId);
  const uploadArtwork = useUploadArtwork(printId);

  const [adding, setAdding] = useState(false);
  // Track which (variationId, side) is mid-upload to show a spinner.
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const variations = print.variations;
  const sides = activeSides(print);
  const ready = variations.filter((v) => pendingSides(print, v) === 0).length;

  const usedInks = new Set(variations.map((v) => v.ink_hex.toLowerCase()));
  const available = printColors.filter((c) => !usedInks.has(c.hex.toLowerCase()));

  const toggleSide = async (side: PrintSide, enabled: boolean) => {
    try {
      await updatePrint.mutateAsync({
        id: printId,
        payload: side === "front" ? { has_front: enabled } : { has_back: enabled },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("saveError"), detail ? { description: detail } : undefined);
    }
  };

  const addVariation = async (hex: string, name: string) => {
    setAdding(false);
    try {
      await createVariation.mutateAsync({ name, ink_hex: hex });
      toast.success(t("created"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("saveError"), detail ? { description: detail } : undefined);
    }
  };

  const removeVariation = async (id: string) => {
    try {
      await deleteVariation.mutateAsync(id);
      toast.success(t("deleted"));
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("saveError"), detail ? { description: detail } : undefined);
    }
  };

  const upload = async (variationId: string, side: PrintSide, file: File) => {
    if (file.type !== "image/png") {
      toast.error(t("pngOnlyError"));
      return;
    }
    const key = `${variationId}:${side}`;
    setUploadingKey(key);
    try {
      await uploadArtwork.mutateAsync({ variationId, side, file });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("uploadError"), detail ? { description: detail } : undefined);
    } finally {
      setUploadingKey((k) => (k === key ? null : k));
    }
  };

  return (
    <section data-testid="print-variations-editor">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
          {t("title")}
        </h2>
        <span
          className={cn(
            "text-[11px] font-semibold",
            ready === variations.length && variations.length > 0
              ? "text-[color:var(--status-ok)]"
              : "text-[color:var(--status-warn)]",
          )}
          data-testid="variations-summary"
        >
          {t("summary", { ready, total: variations.length })}
        </span>
      </div>

      <p className="mb-3 text-[11.5px] leading-relaxed text-[color:var(--orion-ink-3)]">
        {tSides("hint")}
      </p>

      {canWrite ? (
        <div className="mb-3.5">
          <SidesSelector
            hasFront={print.has_front}
            hasBack={print.has_back}
            disabled={updatePrint.isPending}
            onToggle={toggleSide}
          />
        </div>
      ) : null}

      {variations.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[color:var(--orion-line)] px-4 py-6 text-center text-[12.5px] text-[color:var(--orion-ink-3)]">
          {t("empty")}
        </p>
      ) : (
        <div className="grid gap-2">
          {variations.map((v) => {
            const pend = pendingSides(print, v);
            const vReady = pend === 0;
            return (
              <div
                key={v.id}
                data-testid="variation-row"
                className="rounded-[11px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] p-[11px]"
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  <InkChip ink={v.ink_hex} ready={vReady} size={20} />
                  <span className="flex-1 text-[13px] font-medium text-[color:var(--orion-ink)]">
                    {v.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10.5px] font-semibold",
                      vReady ? "text-[color:var(--status-ok)]" : "text-[color:var(--status-warn)]",
                    )}
                  >
                    {vReady ? t("complete") : t("pendingCount", { count: pend })}
                  </span>
                  {canWrite ? (
                    <button
                      type="button"
                      title={t("removeVariation")}
                      disabled={deleteVariation.isPending}
                      onClick={() => removeVariation(v.id)}
                      data-testid={`variation-remove-${v.id}`}
                      className="shrink-0 p-[5px] text-[color:var(--orion-ink-3)] hover:text-[color:var(--status-err)] disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {sides.map((s) => (
                    <SidePngTile
                      key={s}
                      label={tSides(s)}
                      status={s === "front" ? v.front_status : v.back_status}
                      fileUrl={s === "front" ? v.front_file_url : v.back_file_url}
                      uploading={uploadingKey === `${v.id}:${s}`}
                      disabled={!canWrite || uploadArtwork.isPending}
                      onUpload={(file) => upload(v.id, s, file)}
                      testId={`side-tile-${v.id}-${s}`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canWrite ? (
        <div className="mt-2">
          {!adding ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={available.length === 0 || createVariation.isPending}
              onClick={() => setAdding(true)}
              data-testid="variation-add"
              className="h-auto gap-1.5 px-0.5 py-2 text-[12.5px] font-medium text-[color:var(--brand-catalog)]"
            >
              <Plus className="size-3.5" />
              {printColors.length === 0 ? t("noPalette") : t("addInk")}
            </Button>
          ) : (
            <div className="mt-1 rounded-[10px] border border-[color:var(--orion-line)] p-[11px]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                  {t("inkColor")}
                </span>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="p-1 text-[color:var(--orion-ink-3)] hover:text-[color:var(--orion-ink)]"
                  data-testid="variation-add-cancel"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {available.length === 0 ? (
                <p className="text-[12px] text-[color:var(--orion-ink-3)]">
                  {t("allColorsUsed")}
                </p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-2">
                  {available.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => addVariation(c.hex, c.name)}
                      data-testid={`variation-ink-${c.hex}`}
                      className="flex items-center gap-2 rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-2 py-[7px] text-left"
                    >
                      <InkChip ink={c.hex} ready size={18} />
                      <span className="min-w-0 truncate text-[11.5px] text-[color:var(--orion-ink-2)]">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
