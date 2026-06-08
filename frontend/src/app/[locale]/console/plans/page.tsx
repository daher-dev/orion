"use client";

import { useLocale, useTranslations } from "next-intl";
import { LayoutGrid } from "lucide-react";
import { ConsoleHead } from "@/components/console-shell/ConsoleHead";
import { SoonRibbon } from "@/components/console-shell/SoonRibbon";
import { useFormatters } from "@/components/console-shell/primitives";

// Illustrative-only catalog (no Plan/billing model yet). Mirrors the shape in
// /docs/design/admin/data.js so the page reads true to the design.
const PLANS = [
  { id: "gratis", name: "Grátis", price: 0, color: "var(--plan-gratis)", tagline: "Para testar a operação", limits: { membros: "2", pedidos: "50/mês", integracoes: "1", armazenamento: "1 GB" } },
  { id: "atelie", name: "Ateliê", price: 79, color: "var(--plan-atelie)", tagline: "Marcas pequenas e ateliês", limits: { membros: "5", pedidos: "500/mês", integracoes: "3", armazenamento: "5 GB" } },
  { id: "pro", name: "Pro", price: 149, color: "var(--plan-pro)", tagline: "Confecções em crescimento", limits: { membros: "10", pedidos: "5.000/mês", integracoes: "8", armazenamento: "10 GB" } },
  { id: "fabrica", name: "Fábrica", price: 349, color: "var(--plan-fabrica)", tagline: "Alto volume e múltiplas bancas", limits: { membros: "Ilimitado", pedidos: "Ilimitado", integracoes: "Todas", armazenamento: "50 GB" } },
];

const LIMIT_ROWS: [string, keyof (typeof PLANS)[number]["limits"]][] = [
  ["Membros", "membros"],
  ["Pedidos", "pedidos"],
  ["Integrações", "integracoes"],
  ["Armazenamento", "armazenamento"],
];

export default function ConsolePlansPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const { fmtBRL } = useFormatters(locale);

  return (
    <div>
      <ConsoleHead
        icon={LayoutGrid}
        color="#7e5bef"
        eyebrow={t("nav.platform")}
        title={t("plans.title")}
        desc={t("plans.desc")}
      />

      <SoonRibbon className="mb-[18px]">{t("plans.ribbon")}</SoonRibbon>

      <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div
            key={p.id}
            className="flex flex-col overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
          >
            <div style={{ height: 4, background: p.color }} />
            <div className="flex flex-1 flex-col gap-3.5 p-[18px]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} />
                  <span className="font-serif text-[20px] font-medium text-[color:var(--orion-ink)]">{p.name}</span>
                </div>
                <div className="mt-1 text-[12px] text-[color:var(--orion-ink-3)]">{p.tagline}</div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-[32px] font-normal tracking-[-0.02em] text-[color:var(--orion-ink)]">
                  {p.price === 0 ? t("plans.free") : fmtBRL(p.price)}
                </span>
                {p.price > 0 && <span className="text-[12.5px] text-[color:var(--orion-ink-3)]">{t("plans.perMonth")}</span>}
              </div>
              <div className="mt-1 grid gap-2">
                {LIMIT_ROWS.map(([label, key]) => (
                  <div key={key} className="flex justify-between text-[12.5px]">
                    <span className="text-[color:var(--orion-ink-3)]">{label}</span>
                    <span className="font-medium text-[color:var(--orion-ink-2)]">{p.limits[key]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
