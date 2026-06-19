"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { TopProduct } from "@/lib/schemas/dashboard";
import { FabricThumb } from "./FabricThumb";

/**
 * "Top 5 produtos" — products ranked by pieces in the order book. Port of the
 * `<Card title="Top 5 produtos">` block (the `.tp-row` grid) in dashboard.jsx.
 * The fabric swatch tone is derived from the product id (decorative).
 */
export function TopProductsCard({ items }: { items: TopProduct[] }) {
  const t = useTranslations("dashboard.topProducts");
  const maxPieces = Math.max(1, ...items.map((p) => p.pieces));

  return (
    <section
      className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]"
      data-testid="top-products"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--orion-line-soft)] px-[18px] py-[14px]">
        <div>
          <div className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
            {t("title")}
          </div>
          <div className="mt-0.5 text-[12px] text-[color:var(--orion-ink-3)]">
            {t("sub")}
          </div>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 rounded-[5px] px-[9px] py-[4px] text-[12px] font-medium text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)]"
        >
          {t("viewAll")}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-[18px] py-[28px] text-center text-[13px] text-[color:var(--orion-ink-3)]">
          {t("empty")}
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-[10px]">
          {items.map((p, idx) => {
            const lead = idx === 0;
            return (
              <li key={p.product_id}>
                <Link
                  href="/products"
                  className="grid items-center gap-3 rounded-[8px] px-2 py-2 transition-colors hover:bg-[color:var(--orion-bg)]"
                  style={{ gridTemplateColumns: "26px 40px 1fr 64px" }}
                >
                  <span
                    className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-[12px] font-semibold"
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: lead
                        ? "color-mix(in oklab, var(--brand-prod) 16%, var(--orion-surface))"
                        : "var(--orion-surface-2)",
                      color: lead ? "var(--brand-prod)" : "var(--orion-ink-3)",
                    }}
                  >
                    {idx + 1}
                  </span>
                  <FabricThumb seed={p.product_id} size={40} />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-[color:var(--orion-ink)]">
                      {p.code}
                    </div>
                    <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[color:var(--orion-line-soft)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.pieces / maxPieces) * 100}%`,
                          background: "var(--brand-prod)",
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="font-serif text-[19px] leading-none text-[color:var(--orion-ink)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {p.pieces}
                      <small className="ml-[3px] font-sans text-[10.5px] text-[color:var(--orion-ink-3)]">
                        {t("pieces")}
                      </small>
                    </div>
                    <div className="mt-1 text-[11px] text-[color:var(--orion-ink-3)]">
                      {t("orders", { count: p.orders })}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
