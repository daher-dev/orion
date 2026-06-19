"use client";

import { useCallback, useState } from "react";
import { ArrowLeft, FileUp, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/page/PageHead";
import { ImportDropZone } from "@/components/orders-import/ImportDropZone";
import { ImportSummaryPanel } from "@/components/orders-import/ImportSummaryPanel";
import { ImportErrorList } from "@/components/orders-import/ImportErrorList";
import { ImportCommitDialog } from "@/components/orders-import/ImportCommitDialog";
import { useImportUpseller } from "@/hooks/use-orders-import";
import { useCanAccess } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import type { UpsellerImportSummary } from "@/lib/schemas/orders-import";

type Step = "drop" | "review";

/**
 * Two-step Upseller import wizard over a single backend endpoint.
 *
 *  drop    — `ImportDropZone` accepts the .csv export (up to 5 MB). On
 *            analyze we POST it with `dry_run: true` to preview the
 *            strict-match result without writing anything.
 *  review  — `ImportSummaryPanel` shows the counts and `ImportErrorList`
 *            lists the unmatched lines (skipped). The footer commits.
 *  commit  — `ImportCommitDialog` confirms, then we POST the same file
 *            with `dry_run: false`. On success we toast and bounce back
 *            to /orders; re-imports return duplicates, not errors.
 */
export default function OrdersImportPage() {
  const t = useTranslations("ordersImport");
  const router = useRouter();
  const canWrite = useCanAccess("orders.write");

  const [step, setStep] = useState<Step>("drop");
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<UpsellerImportSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const importer = useImportUpseller();

  const handleAnalyze = useCallback(
    async (picked: File) => {
      setAnalyzeError(null);
      try {
        const result = await importer.mutateAsync({ file: picked, dryRun: true });
        if (result.total === 0) {
          setAnalyzeError(t("errors.empty"));
          toast.error(t("toasts.analyzeError"));
          return;
        }
        setFile(picked);
        setSummary(result);
        setStep("review");
      } catch (err) {
        const detail =
          err instanceof ApiError
            ? err.detail
            : err instanceof Error
              ? err.message
              : "";
        setAnalyzeError(detail || t("errors.parseFailed"));
        toast.error(
          t("toasts.analyzeError"),
          detail ? { description: detail } : undefined,
        );
      }
    },
    [importer, t],
  );

  const handleBack = useCallback(() => {
    setStep("drop");
    setFile(null);
    setSummary(null);
    setAnalyzeError(null);
  }, []);

  const handleConfirmCommit = useCallback(async () => {
    if (!file) return;
    try {
      const result = await importer.mutateAsync({ file, dryRun: false });
      setConfirming(false);
      if (result.created > 0) {
        toast.success(t("toasts.commitSuccess", { count: result.created }));
        router.push("/orders");
        return;
      }
      // Nothing new persisted (all duplicates / unmatched). Stay on the
      // page with the refreshed counts so the user can see why.
      setSummary(result);
      toast.message(t("toasts.commitNothing"));
    } catch (err) {
      setConfirming(false);
      const detail =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "";
      toast.error(
        t("toasts.commitError"),
        detail ? { description: detail } : undefined,
      );
    }
  }, [file, importer, router, t]);

  if (!canWrite) {
    return (
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">
        {t("fallback.forbidden")}
      </p>
    );
  }

  const willCreate = summary?.created ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHead
        subColor="var(--brand-sales)"
        mark={<ShoppingBag size={11} strokeWidth={2.2} />}
        eyebrow={t("page.eyebrow")}
        title={t("list.title")}
        titleEm={t("list.titleEm")}
        sub={t("list.sub")}
        actions={
          <Button
            asChild
            variant="ghost"
            className="h-auto gap-2 rounded-[6px] px-[13px] py-[7px] text-[13px] text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]"
          >
            <Link href="/orders">
              <ArrowLeft size={13} strokeWidth={1.8} />
              {t("actions.backToOrders")}
            </Link>
          </Button>
        }
      />

      <StepIndicator step={step} />

      {step === "drop" ? (
        <div className="mx-auto w-full max-w-[640px]">
          <ImportDropZone
            onAnalyze={handleAnalyze}
            busy={importer.isPending}
            errorMessage={analyzeError}
          />
        </div>
      ) : summary ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-serif text-[16px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("review.title")}
            </span>
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {t("review.sub")}
            </span>
          </div>

          <ImportSummaryPanel summary={summary} />

          {summary.errors.length > 0 ? (
            <ImportErrorList errors={summary.errors} />
          ) : (
            <p className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-4 py-3 text-[12.5px] text-[color:var(--orion-ink-2)]">
              {t("review.allGood")}
            </p>
          )}

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              className="h-auto gap-2 rounded-[6px] px-[13px] py-[7px] text-[13px] text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]"
            >
              <ArrowLeft size={13} strokeWidth={1.8} />
              {t("review.back")}
            </Button>
            <Button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={willCreate === 0 || importer.isPending}
              className="h-auto gap-2 rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:opacity-60"
              style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
            >
              <FileUp size={13} strokeWidth={1.8} />
              {willCreate > 0
                ? t("review.commit", { count: willCreate })
                : t("review.nothingToImport")}
            </Button>
          </div>
        </div>
      ) : null}

      <ImportCommitDialog
        open={confirming}
        onOpenChange={setConfirming}
        rowCount={willCreate}
        isPending={importer.isPending}
        onConfirm={handleConfirmCommit}
      />
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const t = useTranslations("ordersImport.steps");
  // "commit" is a virtual step (the dialog), shown in the indicator but never a
  // real `Step` state value — so the item list widens the id union accordingly.
  const items: { id: Step | "commit"; label: string }[] = [
    { id: "drop", label: t("drop") },
    { id: "review", label: t("review") },
    { id: "commit", label: t("commit") },
  ];
  const activeOrder = step === "drop" ? 0 : 1;
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--orion-ink-3)]">
      {items.map((item, idx) => {
        const active = idx <= activeOrder;
        return (
          <li key={item.id} className="flex items-center gap-2">
            <span
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold leading-none"
              style={{
                color: active ? "white" : "var(--orion-ink-3)",
                background: active
                  ? "var(--brand-sales)"
                  : "var(--orion-surface)",
                borderColor: active
                  ? "color-mix(in oklab, var(--brand-sales) 70%, black)"
                  : "var(--orion-line)",
              }}
            >
              {idx + 1}
            </span>
            <span
              className={
                active
                  ? "font-semibold text-[color:var(--orion-ink)]"
                  : undefined
              }
            >
              {item.label}
            </span>
            {idx < items.length - 1 ? (
              <span
                aria-hidden="true"
                className="mx-1 h-px w-6 bg-[color:var(--orion-line)]"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
