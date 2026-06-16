"use client";

import { Factory, GitMerge, PackageCheck, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { ConferencePipeline } from "@/lib/schemas/dashboard";

/**
 * The order-pipeline strip (Mapeamento → Produção → Separação → Envio),
 * distinct from the production `ProductionPipeline`. Counts mirror the
 * Pedidos board columns and route to `/orders`.
 */
const STAGES: {
  key: keyof ConferencePipeline;
  icon: LucideIcon;
  color: string;
}[] = [
  { key: "mapeamento", icon: GitMerge, color: "var(--brand-sales)" },
  { key: "producao", icon: Factory, color: "var(--brand-prod)" },
  { key: "separacao", icon: PackageCheck, color: "var(--status-ok)" },
  { key: "envio", icon: Truck, color: "var(--brand-inv)" },
];

export function OrderPipelineStrip({
  pipeline,
}: {
  pipeline: ConferencePipeline;
}) {
  const t = useTranslations("dashboard.conference.pipeline");
  const router = useRouter();
  const goOrders = () => router.push("/orders");

  return (
    <div
      className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-[18px]"
      data-testid="order-pipeline-strip"
    >
      <h2 className="mb-3.5 font-serif text-[16px] text-[color:var(--orion-ink)]">
        {t("title")}
      </h2>
      <div className="flex items-stretch gap-2">
        {STAGES.map((stage, i) => (
          <div key={stage.key} className="flex flex-1 items-stretch gap-2">
            <button
              type="button"
              onClick={goOrders}
              data-testid={`order-pipeline-${stage.key}`}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-[10px] border p-3 text-center transition-colors hover:bg-[color:var(--orion-surface-2)]"
              style={{
                borderColor: `color-mix(in oklab, ${stage.color} 20%, var(--orion-surface))`,
                background: `color-mix(in oklab, ${stage.color} 6%, var(--orion-surface))`,
              }}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-[9px]"
                style={{
                  background: `color-mix(in oklab, ${stage.color} 15%, var(--orion-surface))`,
                  color: stage.color,
                }}
              >
                <stage.icon size={15} strokeWidth={1.9} />
              </span>
              <span
                className="font-serif text-[22px] leading-none text-[color:var(--orion-ink)]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {pipeline[stage.key].toLocaleString()}
              </span>
              <span className="text-[11px] font-medium text-[color:var(--orion-ink-2)]">
                {t(stage.key)}
              </span>
            </button>
            {i < STAGES.length - 1 ? (
              <div className="flex items-center text-[color:var(--orion-ink-3)]">
                <span aria-hidden="true">›</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
