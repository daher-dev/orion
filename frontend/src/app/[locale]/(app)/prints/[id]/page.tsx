"use client";

import { use, useState } from "react";
import {
  ChevronLeft,
  Clock,
  DollarSign,
  Droplet,
  Maximize,
  Palette,
  Pencil,
  Shirt,
  Tag,
  Thermometer,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHead } from "@/components/page/PageHead";
import { PrintFormSheet } from "@/components/prints/PrintFormSheet";
import { PrintVariationsEditor } from "@/components/prints/variations/PrintVariationsEditor";
import { useCanAccess } from "@/hooks/use-permissions";
import { usePrint } from "@/hooks/use-prints";
import { useProducts } from "@/hooks/use-products";
import type { PrintTechnique } from "@/lib/schemas/print";

type Props = { params: Promise<{ id: string; locale: string }> };

// "Cores aplicadas" — derived from technique, matching the design mockup.
const COLORS_BY_TECHNIQUE: Record<PrintTechnique, string> = {
  dtf: "CMYK + white",
  sublimation: "CMYK",
  silkscreen: "2 colors",
};

export default function PrintDetailPage({ params }: Props) {
  const { id } = use(params);
  const t = useTranslations("prints");
  const format = useFormatter();
  const router = useRouter();
  const canWrite = useCanAccess("prints.write");
  const [editOpen, setEditOpen] = useState(false);

  const printQuery = usePrint(id);
  const usedByQuery = useProducts({ print_id: id });

  if (printQuery.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (printQuery.isError || !printQuery.data) {
    return (
      <div className="rounded-xl border border-[color:var(--status-err)] bg-[color:var(--orion-surface)] p-6 text-[color:var(--status-err)]">
        <h2 className="font-serif text-[20px]">{t("detail.notFound")}</h2>
      </div>
    );
  }

  const print = printQuery.data;
  const usedBy = usedByQuery.data?.items ?? [];

  // "Tamanho da arte": real value when width/height are set, else the mockup's
  // technique-derived default (display only — not persisted).
  const sizeValue =
    print.width_cm && print.height_cm
      ? `${Number(print.width_cm)}×${Number(print.height_cm)}cm`
      : print.technique === "dtf"
        ? "28×35cm"
        : "24×30cm";

  return (
    <div data-testid="print-detail">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link href="/prints">
            <ChevronLeft className="size-3.5" /> {t("detail.back")}
          </Link>
        </Button>
      </div>

      <PageHead
        subColor="var(--brand-catalog)"
        mark={<Palette size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={print.name}
        sub={print.code}
        actions={
          canWrite ? (
            <Button
              type="button"
              onClick={() => setEditOpen(true)}
              data-testid="print-detail-edit"
              className="h-auto gap-[7px] rounded-[6px] border bg-[color:var(--brand-catalog)] !px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95"
              style={{ borderColor: "color-mix(in oklab, var(--brand-catalog) 70%, black)" }}
            >
              <Pencil className="size-3.5" />
              {t("actions.edit")}
            </Button>
          ) : null
        }
      />

      {/* Art preview */}
      <div
        className="mb-4 grid h-[160px] place-items-center overflow-hidden rounded-[12px]"
        style={{
          background: print.image_url
            ? undefined
            : "radial-gradient(circle at 30% 30%, #f4d9b8, #c2410c)",
        }}
      >
        {print.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={print.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Palette size={56} className="text-white/55" />
        )}
      </div>

      {/* Fields grid */}
      <section className="mb-5 grid grid-cols-1 gap-[1px] overflow-hidden rounded-[10px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-line-soft)] sm:grid-cols-2">
        <DetailCell icon={<Palette className="size-3" />} label={t("detail.fields.technique")} value={t(`techniques.${print.technique}`)} />
        <DetailCell
          icon={<DollarSign className="size-3" />}
          label={t("detail.fields.cost")}
          value={format.number(Number(print.cost_per_unit || 0), { style: "currency", currency: "BRL" })}
        />
        <DetailCell icon={<Tag className="size-3" />} label={t("detail.fields.tag")} value={print.tag || "—"} />
        <DetailCell icon={<Droplet className="size-3" />} label={t("detail.fields.colors")} value={COLORS_BY_TECHNIQUE[print.technique]} />
      </section>

      {/* Color variations + per-side PNG upload */}
      <section className="mb-5">
        <PrintVariationsEditor print={print} canWrite={canWrite} />
      </section>

      {/* Application specs — display only (mockup-derived, not persisted) */}
      <section className="mb-5">
        <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
          {t("detail.specs.title")}
        </h2>
        <div className="grid gap-2">
          <SpecRow icon={<Maximize className="size-3.5" />} label={t("detail.specs.size")} value={sizeValue} />
          <SpecRow icon={<Thermometer className="size-3.5" />} label={t("detail.specs.temperature")} value="160°C" />
          <SpecRow icon={<Clock className="size-3.5" />} label={t("detail.specs.pressTime")} value="15s" />
          <SpecRow icon={<Shirt className="size-3.5" />} label={t("detail.specs.position")} value={t("detail.specs.positionValue")} />
        </div>
      </section>

      {/* Products using this print */}
      <section>
        <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
          {t("detail.usedBy.title")}
        </h2>
        {usedBy.length ? (
          <div className="divide-y divide-[color:var(--orion-line-soft)]">
            {usedBy.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/products/${p.id}`)}
                className="flex w-full items-center gap-3 py-2 text-left hover:opacity-80"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-[color:var(--orion-surface-2)] text-[color:var(--orion-ink-3)]">
                  <Shirt size={13} />
                </span>
                <span className="flex-1 text-[13px] font-medium text-[color:var(--orion-ink)]">{p.name}</span>
                <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">{p.variations.length}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-[color:var(--orion-ink-3)]">{t("detail.usedBy.empty")}</p>
        )}
      </section>

      <PrintFormSheet open={editOpen} onOpenChange={setEditOpen} initial={editOpen ? print : undefined} />
    </div>
  );
}

function DetailCell({ icon, label, value }: { icon: React.ReactNode; label: React.ReactNode; value: React.ReactNode }) {
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

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[8px] bg-[color:var(--orion-surface-2)] px-3 py-2">
      <span className="text-[color:var(--orion-ink-3)]">{icon}</span>
      <span className="flex-1 text-[12.5px] text-[color:var(--orion-ink-2)]">{label}</span>
      <span className="text-[12.5px] font-medium text-[color:var(--orion-ink)]">{value}</span>
    </div>
  );
}
