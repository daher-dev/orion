"use client";

import { use, useMemo, useState } from "react";
import { ChevronLeft, FileText, Palette, Pencil, Shirt, Boxes, TrendingUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { ProductFormSheet } from "@/components/products/ProductFormSheet";
import { OrderStatusPill } from "@/components/orders/OrderStatusPill";
import { OrderChannelChip } from "@/components/orders/OrderChannelChip";
import { useCanAccess } from "@/hooks/use-permissions";
import { usePrint } from "@/hooks/use-prints";
import { useProduct } from "@/hooks/use-products";
import { useSpec } from "@/hooks/use-specs";
import { useStockLevels } from "@/hooks/use-stock";
import { useOrders } from "@/hooks/use-orders";
import { useAds } from "@/hooks/use-ads";
import { variantColor } from "@/lib/variant-color";
import { SIZES } from "@/lib/schemas/product";

type Props = { params: Promise<{ id: string; locale: string }> };
type Tab = "overview" | "variations" | "orders" | "ads" | "cost";
const PACKAGING_COST = 1.2;

export default function ProductDetailPage({ params }: Props) {
  const { id } = use(params);
  const t = useTranslations("products");
  const format = useFormatter();
  const router = useRouter();
  const canWrite = useCanAccess("products.write");
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  const productQuery = useProduct(id);
  const specQuery = useSpec(productQuery.data?.spec_id);
  const printQuery = usePrint(productQuery.data?.print_id ?? null);
  const stockQuery = useStockLevels({ product_id: id, page_size: 100 });
  const ordersQuery = useOrders({ product_id: id, page_size: 100 });
  const adsQuery = useAds({ product_id: id });

  const levels = useMemo(() => stockQuery.data?.items ?? [], [stockQuery.data]);
  const totalStock = useMemo(() => levels.reduce((s, l) => s + l.on_hand, 0), [levels]);

  if (productQuery.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <div className="rounded-xl border border-[color:var(--status-err)] bg-[color:var(--orion-surface)] p-6 text-[color:var(--status-err)]">
        <h2 className="font-serif text-[20px]">{t("detail.notFound")}</h2>
      </div>
    );
  }

  const product = productQuery.data;
  const spec = specQuery.data;
  const print = printQuery.data;
  const orders = ordersQuery.data?.items ?? [];
  const ads = adsQuery.data?.items ?? [];

  const specCost = Number(spec?.labor_cost ?? 0);
  const printCost = Number(print?.cost_per_unit ?? 0);
  const totalCost = specCost + printCost + PACKAGING_COST;
  const brl = (v: number) => format.number(v, { style: "currency", currency: "BRL" });

  // Variation colours and the sizes present, ordered by the canonical SIZES list.
  const colors = uniqueBy(product.variations.map((v) => ({ color: v.color, code: v.color_code })), (c) => c.code);
  const sizes = SIZES.filter((s) => product.variations.some((v) => v.size === s));
  const onHandFor = (colorCode: string, size: string) =>
    levels.find((l) => l.color_code === colorCode && l.size === size)?.on_hand ?? 0;

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: t("detail.tabs.overview") },
    { id: "variations", label: `${t("detail.tabs.variations")} (${product.variations.length})` },
    { id: "orders", label: `${t("detail.tabs.orders")} (${orders.length})` },
    { id: "ads", label: `${t("detail.tabs.ads")} (${ads.length})` },
    { id: "cost", label: t("detail.tabs.cost") },
  ];

  return (
    <div data-testid="product-detail">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/products">
            <ChevronLeft className="size-3.5" /> {t("detail.back")}
          </Link>
        </Button>
      </div>

      <PageHead
        subColor="var(--brand-catalog)"
        mark={<Shirt size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={product.name}
        sub={t(`productTypes.${product.product_type}`)}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setEditOpen(true)}
              data-testid="product-detail-edit"
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{ borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)" }}
            >
              <Pencil className="size-3.5" />
              {t("actions.edit")}
            </Button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-[color:var(--orion-line-soft)]">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className="border-b-2 px-2.5 py-2 text-[13px]"
            style={{
              borderColor: tab === tb.id ? "var(--brand-catalog)" : "transparent",
              color: tab === tb.id ? "var(--orion-ink)" : "var(--orion-ink-3)",
              fontWeight: tab === tb.id ? 500 : 400,
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4">
          <section className="grid grid-cols-1 gap-[1px] overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-line-soft)] sm:grid-cols-3">
            <DetailCell
              icon={<FileText className="size-3" />}
              label={t("detail.overview.spec")}
              value={spec ? `${spec.code} — ${spec.name}` : product.spec_id.slice(0, 8)}
              onClick={() => router.push("/specs")}
            />
            <DetailCell
              icon={<Palette className="size-3" />}
              label={t("detail.overview.print")}
              value={print ? `${print.code} — ${print.name}` : t("detail.overview.noPrint")}
              onClick={print ? () => router.push(`/prints/${print.id}`) : undefined}
            />
            <DetailCell icon={<Boxes className="size-3" />} label={t("detail.overview.stock")} value={String(totalStock)} />
          </section>

          <Field label={t("detail.overview.colors")}>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <span key={c.code} className="flex items-center gap-1.5 rounded-full bg-[color:var(--orion-surface-2)] py-1 pl-1 pr-2.5">
                  <span className="size-4 rounded-full border border-[color:var(--orion-surface)] shadow-[0_0_0_1px_var(--orion-line)]" style={{ background: variantColor(c.code) }} />
                  <span className="text-[12px] text-[color:var(--orion-ink)]">{c.color}</span>
                </span>
              ))}
            </div>
          </Field>

          <Field label={t("detail.overview.sizes")}>
            <div className="flex gap-1.5">
              {sizes.map((s) => (
                <span key={s} className="rounded-[6px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-2 py-0.5 text-[12px] text-[color:var(--orion-ink-2)]">
                  {s.toUpperCase()}
                </span>
              ))}
            </div>
          </Field>
        </div>
      )}

      {tab === "variations" && (
        <div>
          <div className="overflow-auto rounded-[8px] border border-[color:var(--orion-line-soft)]">
            <table className="w-full border-separate border-spacing-0 text-[13px]">
              <thead>
                <tr>
                  <th className="border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {t("detail.variationsTab.color")}
                  </th>
                  {sizes.map((s) => (
                    <th key={s} className="border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                      {s.toUpperCase()}
                    </th>
                  ))}
                  <th className="border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-bg)] px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                    {t("detail.variationsTab.total")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {colors.map((c) => {
                  const rowTotal = sizes.reduce((s, sz) => s + onHandFor(c.code, sz), 0);
                  return (
                    <tr key={c.code}>
                      <td className="border-b border-[color:var(--orion-line-soft)] px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span className="size-4 rounded-full border border-[color:var(--orion-surface)] shadow-[0_0_0_1px_var(--orion-line)]" style={{ background: variantColor(c.code) }} />
                          {c.color}
                        </span>
                      </td>
                      {sizes.map((sz) => {
                        const n = onHandFor(c.code, sz);
                        const low = n < 4;
                        return (
                          <td key={sz} className="border-b border-[color:var(--orion-line-soft)] px-3 py-2 text-right tabular-nums">
                            <span
                              className="inline-block min-w-9 rounded-[6px] px-2 py-0.5 font-medium"
                              style={{
                                background: low ? "color-mix(in oklab, var(--status-err) 12%, var(--orion-surface))" : "var(--orion-surface-2)",
                                color: low ? "var(--status-err)" : "var(--orion-ink)",
                              }}
                            >
                              {n}
                            </span>
                          </td>
                        );
                      })}
                      <td className="border-b border-[color:var(--orion-line-soft)] px-3 py-2 text-right font-medium tabular-nums text-[color:var(--orion-ink)]">
                        {rowTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2.5 text-[11px] text-[color:var(--orion-ink-3)]">{t("detail.variationsTab.lowStockNote")}</p>
        </div>
      )}

      {tab === "orders" && (
        <div>
          {orders.length ? (
            <div className="divide-y divide-[color:var(--orion-line-soft)]">
              {orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80"
                >
                  <span className="flex-1">
                    <span className="block text-[13px] font-medium text-[color:var(--orion-ink)]">
                      {o.external_order_id ?? o.id.slice(0, 8)}
                    </span>
                    <span className="block text-[11px] text-[color:var(--orion-ink-3)]">
                      {o.variation.color} {o.variation.size.toUpperCase()}
                    </span>
                  </span>
                  <OrderChannelChip channel={o.ad.ecommerce} />
                  <OrderStatusPill status={o.status} />
                  <span className="w-8 text-right text-[13px] tabular-nums text-[color:var(--orion-ink-3)]">×{o.quantity}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyTab title={t("detail.ordersTab.empty")} body={t("detail.ordersTab.emptyBody")} />
          )}
        </div>
      )}

      {tab === "ads" && (
        <div className="grid gap-2">
          {ads.length ? (
            ads.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => router.push(`/ads/${a.id}`)}
                className="flex items-center gap-3 rounded-[10px] bg-[color:var(--orion-surface-2)] p-3 text-left hover:opacity-80"
              >
                <OrderChannelChip channel={a.ecommerce} />
                <span className="flex-1 text-[13px] font-medium text-[color:var(--orion-ink)]">{a.title}</span>
              </button>
            ))
          ) : (
            <EmptyTab title={t("detail.adsTab.empty")} body={t("detail.adsTab.emptyBody")} />
          )}
        </div>
      )}

      {tab === "cost" && (
        <div>
          <div className="overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)]">
            <CostRow icon={<FileText className="size-3.5" />} label={t("detail.cost.spec")} sub={spec?.name} value={brl(specCost)} />
            <CostRow icon={<Palette className="size-3.5" />} label={t("detail.cost.print")} sub={print?.name} value={brl(printCost)} />
            <CostRow icon={<Boxes className="size-3.5" />} label={t("detail.cost.packaging")} sub={t("detail.cost.packagingSub")} value={brl(PACKAGING_COST)} />
            <div className="flex items-center justify-between bg-[color:var(--orion-surface-2)] px-3.5 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">{t("detail.cost.total")}</span>
              <span className="font-serif text-[20px] text-[color:var(--orion-ink)]">{brl(totalCost)}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-[8px] px-3 py-3 text-[12px] text-[color:var(--orion-ink-2)]" style={{ background: "color-mix(in oklab, var(--brand-catalog) 8%, var(--orion-surface))" }}>
            <TrendingUp size={14} /> {t("detail.cost.margin")}
            <strong className="ml-auto text-[color:var(--orion-ink)]">{brl(totalCost * 4)}</strong>
          </div>
        </div>
      )}

      <ProductFormSheet open={editOpen} onOpenChange={setEditOpen} initial={editOpen ? product : null} />
    </div>
  );
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

function DetailCell({ icon, label, value, onClick }: { icon: React.ReactNode; label: React.ReactNode; value: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="bg-[color:var(--orion-surface)] p-[12px_14px] text-left enabled:hover:bg-[color:var(--orion-bg)] disabled:cursor-default"
    >
      <div className="mb-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {icon}
        {label}
      </div>
      <div className="text-[13.5px] text-[color:var(--orion-ink)]">{value}</div>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">{label}</div>
      {children}
    </div>
  );
}

function EmptyTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid place-items-center gap-1 px-4 py-12 text-center">
      <p className="text-[13px] font-medium text-[color:var(--orion-ink)]">{title}</p>
      <p className="text-[12px] text-[color:var(--orion-ink-3)]">{body}</p>
    </div>
  );
}

function CostRow({ icon, label, sub, value }: { icon: React.ReactNode; label: string; sub?: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-3.5 py-3 last:border-b-0">
      <span className="text-[color:var(--orion-ink-3)]">{icon}</span>
      <span className="flex flex-1 flex-col">
        <span className="text-[12.5px] text-[color:var(--orion-ink)]">{label}</span>
        {sub ? <span className="text-[11px] text-[color:var(--orion-ink-3)]">{sub}</span> : null}
      </span>
      <span className="font-medium tabular-nums text-[color:var(--orion-ink)]">{value}</span>
    </div>
  );
}
