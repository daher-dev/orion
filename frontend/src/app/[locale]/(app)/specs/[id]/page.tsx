"use client";

import { useState, use } from "react";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { useDeleteSpec, useSpec, useUpdateSpec } from "@/hooks/use-specs";
import { ApiError } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
import { Can } from "@/components/Can";
import { SpecDetailHeader } from "@/components/specs/SpecDetailHeader";
import { SpecForm, type SpecFormSubmit } from "@/components/specs/SpecForm";

export default function SpecDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const query = useSpec(id);
  const update = useUpdateSpec(id);
  const remove = useDeleteSpec();
  const [isEditing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (query.isPending) {
    return (
      <div className="space-y-3" data-testid="spec-detail-loading">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError) {
    if (query.error.status === 404) {
      return (
        <div className="rounded-xl border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6">
          <h2 className="font-serif text-[20px]">{t("common.error")}</h2>
          <p className="text-[13px] text-[color:var(--orion-ink-3)]">{query.error.detail}</p>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/specs">{t("specs.actions.back")}</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-[color:var(--status-err)] p-6 text-[color:var(--status-err)]">
        {query.error.detail}
      </div>
    );
  }

  const spec = query.data;
  const trimsSubtotal = spec.trims.reduce(
    (acc, t) => acc + Number(t.unit_price) * t.quantity,
    0,
  );
  const totalCost = trimsSubtotal + Number(spec.labor_cost);
  const sale = Number(spec.sale_price ?? 0);
  const margin = sale > 0 ? ((sale - totalCost) / sale) * 100 : 0;

  const handleSubmit = async (payload: SpecFormSubmit) => {
    await update.mutateAsync(payload);
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await remove.mutateAsync(spec.id);
      router.push("/specs");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError(t("specs.form.validation.linkedProducts"));
      } else if (err instanceof ApiError) {
        setDeleteError(err.detail);
      } else {
        throw err;
      }
    }
  };

  return (
    <div data-testid="spec-detail-page">
      <SpecDetailHeader
        eyebrow={t("specs.page.eyebrow")}
        title={spec.name}
        sub={
          <span className="font-mono text-[12px] text-[color:var(--orion-ink-3)]">{spec.code}</span>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/specs">
                <ChevronLeft className="size-3.5" /> {t("specs.actions.back")}
              </Link>
            </Button>
            <Can permission="specs.write">
              <Button
                variant="outline"
                onClick={() => setEditing((v) => !v)}
                data-testid="spec-detail-edit"
              >
                <Pencil className="size-3.5" /> {t("specs.actions.edit")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                data-testid="spec-detail-delete"
              >
                <Trash2 className="size-3.5" /> {t("specs.actions.delete")}
              </Button>
            </Can>
          </>
        }
      />

      {isEditing ? (
        <div className="rounded-xl border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-6">
          <SpecForm
            initial={spec}
            submitting={update.isPending}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(false)}
            apiError={update.error ?? null}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <section
            className="rounded-xl border border-[color:var(--orion-line)] bg-[color:var(--orion-surface-2)] p-5"
            data-testid="spec-detail-fabric"
          >
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
              {t(`specs.fabricTypes.${spec.fabric_type}`)}
            </div>
            <div className="mt-1 font-serif text-[22px] text-[color:var(--orion-ink)]">
              {t(`specs.fabricTypes.${spec.fabric_type}`)}
            </div>
            <div className="mt-4 flex flex-wrap gap-7">
              <Stat
                label={t("specs.detail.stats.grammage")}
                value={`${spec.fabric_grammage_gsm}`}
                suffix="g/m²"
              />
              <Stat
                label={t("specs.detail.stats.weight")}
                value={`${Number(spec.fabric_weight_per_piece_g).toFixed(2)}`}
                suffix="g"
              />
              <Stat
                label={t("specs.detail.stats.ribana")}
                value={spec.has_ribana ? `${spec.ribana_weight_pct}%` : "—"}
              />
            </div>
          </section>

          <section
            className="rounded-xl border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5"
            data-testid="spec-detail-trims"
          >
            <header className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
              {t("specs.detail.stats.trims")} ({spec.trims.length})
            </header>
            <div className="overflow-hidden rounded-lg border border-[color:var(--orion-line-soft)]">
              {spec.trims.map((trim, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between border-b border-[color:var(--orion-line-soft)] px-3.5 py-2.5 text-[13px] last:border-b-0 ${i % 2 ? "bg-[color:var(--orion-surface)]" : "bg-transparent"}`}
                >
                  <span className="text-[color:var(--orion-ink)]">
                    {t(`specs.trimTypes.${trim.trim_type}`)} × {trim.quantity}
                  </span>
                  <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
                    {format.number(Number(trim.unit_price) * trim.quantity, {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-[color:var(--orion-surface-2)] px-3.5 py-2.5 text-[12.5px]">
                <span className="font-medium text-[color:var(--orion-ink-2)]">
                  {t("specs.detail.stats.trimsSubtotal")}
                </span>
                <span className="font-serif text-[14px] text-[color:var(--orion-ink)]">
                  {format.number(trimsSubtotal, { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5">
            <header className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
              {t("specs.form.sections.pricing")}
            </header>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DetailCell
                label={t("specs.detail.stats.labor")}
                value={format.number(Number(spec.labor_cost), {
                  style: "currency",
                  currency: "BRL",
                })}
              />
              <DetailCell
                label={t("specs.detail.stats.trims")}
                value={format.number(trimsSubtotal, {
                  style: "currency",
                  currency: "BRL",
                })}
              />
              <DetailCell
                label={t("specs.detail.stats.totalCost")}
                value={format.number(totalCost, { style: "currency", currency: "BRL" })}
              />
              <DetailCell
                label={t("specs.detail.stats.sale")}
                value={
                  spec.sale_price && Number(spec.sale_price) > 0
                    ? format.number(Number(spec.sale_price), {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"
                }
              />
            </dl>
            {sale > 0 ? (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-[color:var(--orion-surface-2)] px-3.5 py-2.5 text-[13px]">
                <span className="text-[color:var(--orion-ink-2)]">
                  {t("specs.detail.stats.margin")}
                </span>
                <span className="font-serif text-[18px] text-[color:var(--orion-ink)]">
                  {margin.toFixed(1)}%
                </span>
              </div>
            ) : null}
          </section>

          {spec.notes ? (
            <section className="rounded-xl border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-5">
              <header className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
                {t("specs.form.sections.notes")}
              </header>
              <p className="whitespace-pre-line text-[13px] text-[color:var(--orion-ink-2)]">
                {spec.notes}
              </p>
            </section>
          ) : null}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("specs.actions.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteError ?? t("specs.actions.confirmDeleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("specs.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} data-testid="spec-detail-confirm-delete">
              {t("specs.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {label}
      </div>
      <div className="mt-1 font-serif text-[24px] leading-none text-[color:var(--orion-ink)]">
        {value}
        {suffix ? <span className="ml-1 text-[12px] text-[color:var(--orion-ink-3)]">{suffix}</span> : null}
      </div>
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-3 py-2.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--orion-ink-3)]">
        {label}
      </dt>
      <dd className="mt-1 text-[13.5px] font-medium text-[color:var(--orion-ink)]">{value}</dd>
    </div>
  );
}
