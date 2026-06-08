"use client";

import { useTranslations } from "next-intl";
import { PlugZap } from "lucide-react";
import { ConsoleHead } from "@/components/console-shell/ConsoleHead";
import { SoonRibbon } from "@/components/console-shell/SoonRibbon";

// Illustrative-only connector catalog (no integration-health telemetry yet).
// Mirrors /docs/design/admin/data.js so the page reads true to the design.
const INTEGRATIONS = [
  { id: "shopee", name: "Shopee", group: "Marketplaces", color: "#ee4d2d" },
  { id: "ml", name: "Mercado Livre", group: "Marketplaces", color: "#fff159", fg: "#1f1f1f" },
  { id: "shopify", name: "Shopify", group: "Marketplaces", color: "#7ab55c" },
  { id: "instagram", name: "Instagram Shop", group: "Marketplaces", color: "#d6249f" },
  { id: "correios", name: "Correios", group: "Logística", color: "#fcb900", fg: "#1f1f1f" },
  { id: "bling", name: "Bling ERP", group: "Logística", color: "#1e88e5" },
  { id: "melhorenvio", name: "Melhor Envio", group: "Logística", color: "#0fb9b1" },
  { id: "whatsapp", name: "WhatsApp Business", group: "Comunicação", color: "#25d366" },
];

const GROUPS = ["Marketplaces", "Logística", "Comunicação"];

export default function ConsoleIntegrationsPage() {
  const t = useTranslations("console");

  return (
    <div>
      <ConsoleHead
        icon={PlugZap}
        color="#c2410c"
        eyebrow={t("nav.platform")}
        title={t("integrations.title")}
        desc={t("integrations.desc")}
      />

      <SoonRibbon className="mb-[18px]">{t("integrations.ribbon")}</SoonRibbon>

      {GROUPS.map((g) => {
        const items = INTEGRATIONS.filter((i) => i.group === g);
        if (!items.length) return null;
        return (
          <div key={g} className="mb-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-[12.5px] font-semibold text-[color:var(--orion-ink-2)]">{g}</span>
              <span className="h-px flex-1 bg-[color:var(--orion-line)]" />
            </div>
            <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center gap-3 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-4"
                >
                  <span
                    className="grid size-[42px] shrink-0 place-items-center rounded-[10px] font-serif text-[15px] font-semibold"
                    style={{ background: it.color, color: it.fg ?? "#fff" }}
                  >
                    {it.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-serif text-[15px] font-medium text-[color:var(--orion-ink)]">{it.name}</div>
                    <div className="text-[11.5px] text-[color:var(--orion-ink-3)]">{t("integrations.connector")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
