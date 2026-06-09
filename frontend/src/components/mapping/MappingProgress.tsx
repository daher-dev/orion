"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MappingProgress as MappingProgressData } from "@/lib/schemas/mapping";

type Props = {
  progress: MappingProgressData;
};

/**
 * De/Para progress card — ports the progress block from
 * `docs/design/pages/lotes.jsx` MapeamentoTab. Shows how many order items are
 * still awaiting a link (plus how many have a ready suggestion) and a bar that
 * turns green at 100%. Also renders the "all linked" success banner.
 *
 * The design's terracotta "accent" maps to the Sales brand colour here
 * (`--brand-sales`); status colours use `--status-ok` / `--status-warn`.
 */
export function MappingProgress({ progress }: Props) {
  const t = useTranslations("mapping");
  const { total, linked, pending, with_suggestion } = progress;
  const pct = total > 0 ? Math.round((linked / total) * 100) : 0;
  const complete = total > 0 && pending === 0;

  return (
    <div data-testid="mapping-progress">
      <div className="mb-3.5 flex items-center gap-[18px] rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4">
        <div className="flex-1">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] text-[color:var(--orion-ink-2)]">
              {pending > 0 ? (
                <>
                  <b className="font-serif text-[18px] text-[color:var(--status-warn)]">
                    {pending}
                  </b>{" "}
                  {t("progress.awaiting", { count: pending })}
                  {with_suggestion > 0 ? (
                    <span className="text-[color:var(--brand-sales)]">
                      {" · "}
                      {t("progress.withSuggestion", { count: with_suggestion })}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <b className="font-serif text-[18px] text-[color:var(--orion-ink)]">
                    {linked}
                  </b>{" "}
                  {t("progress.linkedOf", { total })}
                </>
              )}
            </span>
            <span
              className="text-[12.5px] font-medium"
              style={{
                color: complete ? "var(--status-ok)" : "var(--orion-ink-3)",
              }}
            >
              {pct}%
            </span>
          </div>
          {/* Inline bar: the shared Progress UI can't recolour its indicator,
              and the design tints it green at 100% / accent otherwise. */}
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-[7px] overflow-hidden rounded-full bg-[color:var(--orion-line-soft)]"
          >
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${pct}%`,
                background: complete ? "var(--status-ok)" : "var(--brand-sales)",
              }}
            />
          </div>
        </div>
      </div>

      {complete ? (
        <div
          data-testid="mapping-complete-banner"
          className="mb-3.5 flex items-center gap-2.5 rounded-[10px] border px-4 py-3 text-[13px]"
          style={{
            background: "color-mix(in oklab, var(--status-ok) 14%, var(--orion-surface))",
            borderColor: "color-mix(in oklab, var(--status-ok) 22%, var(--orion-surface))",
            color: "var(--status-ok)",
          }}
        >
          <CheckCircle2 size={16} />
          {t("progress.allLinked")}
        </div>
      ) : null}
    </div>
  );
}
