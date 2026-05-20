"use client";

import { use, useState } from "react";
import { ChevronLeft, FileText, Hash, Palette, Pencil, Shirt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { ProductFormSheet } from "@/components/products/ProductFormSheet";
import { VariationMatrix } from "@/components/products/VariationMatrix";
import { useCanAccess } from "@/hooks/use-permissions";
import { usePrint } from "@/hooks/use-prints";
import { useProduct } from "@/hooks/use-products";
import { useSpec } from "@/hooks/use-specs";

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export default function ProductDetailPage({ params }: Props) {
  const { id } = use(params);
  const t = useTranslations("products");
  const canWrite = useCanAccess("products.write");
  const [editOpen, setEditOpen] = useState(false);

  const productQuery = useProduct(id);
  const specQuery = useSpec(productQuery.data?.spec_id);
  const printQuery = usePrint(productQuery.data?.print_id ?? null);

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
              style={{
                borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)",
              }}
            >
              <Pencil className="size-3.5" />
              {t("actions.edit")}
            </Button>
          ) : null
        }
      />

      <section className="mb-6 grid grid-cols-1 gap-[1px] overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-line-soft)] sm:grid-cols-3">
        <DetailCell
          icon={<Hash className="size-3" />}
          label={t("detail.meta.totalVariations")}
          value={String(product.variations.length)}
        />
        <DetailCell
          icon={<FileText className="size-3" />}
          label={t("detail.meta.spec")}
          value={spec ? `${spec.code} — ${spec.name}` : product.spec_id.slice(0, 8)}
        />
        <DetailCell
          icon={<Palette className="size-3" />}
          label={t("detail.meta.print")}
          value={print ? `${print.code} — ${print.name}` : t("detail.meta.noPrint")}
        />
      </section>

      <section>
        <h2 className="mb-3 border-b border-[color:var(--orion-line-soft)] pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--orion-ink-3)]">
          {t("variations.title")}
        </h2>
        <VariationMatrix variations={product.variations} />
      </section>

      <ProductFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={editOpen ? product : null}
      />
    </div>
  );
}

function DetailCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-[color:var(--orion-surface)] p-[12px_14px]">
      <div className="mb-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {icon}
        {label}
      </div>
      <div className="text-[13.5px] text-[color:var(--orion-ink)]">{value}</div>
    </div>
  );
}
