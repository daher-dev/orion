"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteAd } from "@/hooks/use-ads";
import { useCanAccess } from "@/hooks/use-permissions";
import type { Ad, Ecommerce } from "@/lib/schemas/ad";
import { ECOMMERCE_CHANNELS } from "@/lib/schemas/ad";
import { CHANNEL_THEME } from "./channel-theme";

export { CHANNEL_THEME };

type Props = {
  rows: Ad[];
  onEdit: (ad: Ad) => void;
};

export function AdsGrid({ rows, onEdit }: Props) {
  const t = useTranslations("ads");
  const canWrite = useCanAccess("ads.write");
  const [pendingDelete, setPendingDelete] = useState<Ad | null>(null);
  const deleteAd = useDeleteAd();

  // Group the rows by channel, preserving the channel order defined in the
  // schema. Empty channels are skipped so the grid only shows what exists.
  const groups = useMemo(() => {
    const buckets = new Map<Ecommerce, Ad[]>();
    for (const ch of ECOMMERCE_CHANNELS) buckets.set(ch, []);
    for (const ad of rows) {
      const list = buckets.get(ad.ecommerce);
      if (list) list.push(ad);
    }
    return ECOMMERCE_CHANNELS
      .map((ch) => ({ channel: ch, items: buckets.get(ch) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [rows]);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteAd.mutateAsync(pendingDelete.id);
      toast.success(t("toasts.deleted"));
      setPendingDelete(null);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "";
      toast.error(t("toasts.error"), detail ? { description: detail } : undefined);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-[22px]" style={{ padding: "18px 16px" }}>
        {groups.map((group) => {
          const theme = CHANNEL_THEME[group.channel];
          return (
            <section key={group.channel} className="flex flex-col gap-2">
              {/* Channel header — mirrors design's section eyebrow with the
                  channel chip + count label. */}
              <header className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2">
                  <span
                    className="ch-chip-dot inline-grid h-[16px] w-[16px] place-items-center rounded-full text-[8.5px] font-bold"
                    style={{ background: theme.color, color: theme.fg }}
                    aria-hidden="true"
                  >
                    {theme.short}
                  </span>
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-2)]">
                    {t(`channels.${group.channel}` as never)}
                  </span>
                  <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                    · {group.items.length}
                  </span>
                </div>
              </header>

              {/* Card grid — design source: `.grid` 14px gap, 1fr columns
                  collapsing into 2 then 3 on wider viewports. */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((ad) => (
                  <article
                    key={ad.id}
                    onClick={() => onEdit(ad)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onEdit(ad);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={ad.title}
                    className="group/ad-card flex cursor-pointer flex-col gap-2 rounded-[12px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-3 text-left transition-colors hover:bg-[color:var(--orion-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-sales)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="ch-chip inline-flex items-center gap-1.5 rounded-full border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-1.5 py-[2px] text-[11.5px] font-medium text-[color:var(--orion-ink)]"
                      >
                        <span
                          className="inline-grid h-[16px] w-[16px] place-items-center rounded-full text-[8.5px] font-bold"
                          style={{ background: theme.color, color: theme.fg }}
                        >
                          {theme.short}
                        </span>
                        {t(`channels.${group.channel}` as never)}
                      </span>
                      <ChevronRight
                        size={14}
                        strokeWidth={1.8}
                        className="mt-0.5 text-[color:var(--orion-ink-3)] opacity-0 transition-opacity group-hover/ad-card:opacity-100"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="line-clamp-2 font-serif text-[15px] font-normal leading-tight text-[color:var(--orion-ink)]">
                        {ad.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[11.5px] text-[color:var(--orion-ink-3)]">
                        <span className="font-mono text-[11px] text-[color:var(--orion-ink-2)]">
                          {ad.product.code}
                        </span>
                        <span className="text-[color:var(--orion-line)]">·</span>
                        <span className="truncate">{ad.product.name}</span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 border-t border-[color:var(--orion-line-soft)] pt-2 text-[11px] text-[color:var(--orion-ink-3)]">
                      <span className="inline-flex items-center gap-1 truncate">
                        {ad.external_id ? (
                          <>
                            <ExternalLink size={10} strokeWidth={1.8} />
                            <span className="font-mono">{ad.external_id}</span>
                          </>
                        ) : (
                          <span className="italic">{t("card.noExternalId")}</span>
                        )}
                      </span>
                      {canWrite ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("actions.delete")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete(ad);
                          }}
                          className="h-7 w-7 rounded-[6px] text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-bg)] hover:text-[color:var(--status-err)]"
                        >
                          <Trash2 size={12} strokeWidth={1.8} />
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("actions.confirmDelete")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAd.isPending}>
              {t("form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteAd.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
