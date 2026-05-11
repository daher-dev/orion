"use client";

import { useTranslations } from "next-intl";
import type { Product, Size } from "@/lib/schemas/product";

type Props = {
  variations: Product["variations"];
};

/**
 * Read-only variation matrix shown on the detail page. Each cell is a 44×44
 * rounded card carrying the size letter at the top, a color swatch hint, and
 * the tiny SKU underneath — mirrors `/docs/design/source/pages/catalog.jsx`
 * ProductDetail's "variations" tab.
 */
export function VariationMatrix({ variations }: Props) {
  const t = useTranslations("products");

  if (variations.length === 0) {
    return (
      <div
        className="rounded-[10px] bg-[color:var(--orion-surface-2)] px-4 py-6 text-center text-[12.5px] text-[color:var(--orion-ink-3)]"
        data-testid="variation-matrix-empty"
      >
        {t("variations.noVariations")}
      </div>
    );
  }

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
      data-testid="variation-matrix"
    >
      {variations.map((v) => (
        <div
          key={v.id}
          data-testid={`variation-cell-${v.sku}`}
          className="grid min-h-[88px] rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-[15px] text-[color:var(--orion-ink)]">
              {t(`variations.sizes.${v.size as Size}`)}
            </span>
            <span
              className="size-3 rounded-full border border-white shadow-[0_0_0_1px_var(--orion-line)]"
              style={{ background: guessHex(v.color_code) }}
              aria-hidden
            />
          </div>
          <div className="text-[11px] text-[color:var(--orion-ink-3)]">{v.color}</div>
          <div className="mt-auto font-mono text-[10.5px] text-[color:var(--orion-ink-2)]">
            {v.sku}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Best-effort swatch tint. The DB doesn't carry the hex; we approximate from
 * the well-known color codes used by the design source. Anything unknown falls
 * back to a neutral stone — never a brand color.
 */
function guessHex(code: string): string {
  const map: Record<string, string> = {
    PRT: "#1f1f1f",
    OFF: "#f4f1ea",
    MAR: "#7a4b2a",
    ARE: "#c9b9a3",
    BEG: "#cfb98e",
    MUS: "#7a8a76",
    VRD: "#3a4a3d",
    CAR: "#6b4a2e",
    VRM: "#b03a2e",
    AZM: "#2a3b5a",
  };
  return map[code.toUpperCase()] ?? "var(--orion-surface-2)";
}
