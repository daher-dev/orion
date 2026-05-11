"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, FileUp, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHead } from "@/components/page/PageHead";
import { ImportDropZone } from "@/components/orders-import/ImportDropZone";
import { ImportPreviewTable } from "@/components/orders-import/ImportPreviewTable";
import { ImportCommitDialog } from "@/components/orders-import/ImportCommitDialog";
import { ImportErrorList } from "@/components/orders-import/ImportErrorList";
import {
  useCommitOrders,
  useParseOrders,
} from "@/hooks/use-orders-import";
import { useCanAccess } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api-client";
import type {
  CommitOrderError,
  EditableField,
  ParsedOrderRow,
} from "@/lib/schemas/orders-import";

type Step = "drop" | "review";

/**
 * Three-step Orders Import wizard.
 *
 *  drop    — `ImportDropZone` accepts a .pdf / .csv up to 5 MB. The
 *            spinner state lives on the dropzone itself while /parse
 *            is in flight.
 *  review  — `ImportPreviewTable` renders the editable parsed rows
 *            with confidence pills. The footer offers Back + Commit.
 *  commit  — `ImportCommitDialog` is the modal that confirms the
 *            persistence. On success we toast and bounce back to
 *            /orders. On partial failure we render the per-row error
 *            list above the table and let the user retry after fixing.
 */
export default function OrdersImportPage() {
  const t = useTranslations("ordersImport");
  const router = useRouter();
  const canWrite = useCanAccess("orders.write");

  const [step, setStep] = useState<Step>("drop");
  const [rows, setRows] = useState<ParsedOrderRow[]>([]);
  const [parserNotes, setParserNotes] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [commitErrors, setCommitErrors] = useState<CommitOrderError[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const parse = useParseOrders();
  const commit = useCommitOrders();

  const errorsByIndex = useMemo<Record<number, string>>(() => {
    return Object.fromEntries(
      commitErrors.map((error) => [error.row_index, error.message]),
    );
  }, [commitErrors]);

  const handleAnalyze = useCallback(
    async (file: File) => {
      setParseError(null);
      try {
        const response = await parse.mutateAsync(file);
        setRows(response.rows);
        setParserNotes(response.notes ?? null);
        setCommitErrors([]);
        if (response.rows.length === 0) {
          setParseError(t("errors.parseEmpty"));
          toast.error(t("toasts.parseError"));
          return;
        }
        setStep("review");
        toast.success(
          t("toasts.parseSuccess", { count: response.rows.length }),
        );
      } catch (err) {
        const detail =
          err instanceof ApiError
            ? err.detail
            : err instanceof Error
              ? err.message
              : "";
        setParseError(detail || t("errors.parseFailed"));
        toast.error(t("toasts.parseError"), detail ? { description: detail } : undefined);
      }
    },
    [parse, t],
  );

  const handleUpdateRow = useCallback(
    (rowIndex: number, field: EditableField, value: string) => {
      setRows((current) =>
        current.map((row) => {
          if (row.row_index !== rowIndex) return row;
          if (field === "quantity") {
            const parsed = value === "" ? null : Number.parseInt(value, 10);
            return {
              ...row,
              quantity:
                parsed != null && !Number.isNaN(parsed) ? parsed : null,
            };
          }
          if (field === "sale_price") {
            return { ...row, sale_price: value === "" ? null : value };
          }
          if (field === "ordered_at") {
            // <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm".
            return {
              ...row,
              ordered_at: value === "" ? null : new Date(value).toISOString(),
            };
          }
          return { ...row, [field]: value === "" ? null : value };
        }),
      );
    },
    [],
  );

  const handleRemoveRow = useCallback((rowIndex: number) => {
    setRows((current) => current.filter((row) => row.row_index !== rowIndex));
    setCommitErrors((current) =>
      current.filter((error) => error.row_index !== rowIndex),
    );
  }, []);

  const handleBack = useCallback(() => {
    setStep("drop");
    setRows([]);
    setParserNotes(null);
    setCommitErrors([]);
    setParseError(null);
  }, []);

  const handleConfirmCommit = useCallback(async () => {
    if (rows.length === 0) return;
    try {
      const response = await commit.mutateAsync({ rows });
      if (response.errors.length === 0) {
        toast.success(t("toasts.commitSuccess", { count: response.created }));
        setConfirming(false);
        router.push("/orders");
        return;
      }
      // Partial failure — keep the user on the page, surface the errors,
      // remove the rows that did persist so they can retry the rest.
      setConfirming(false);
      setCommitErrors(response.errors);
      const failingIndexes = new Set(
        response.errors.map((error) => error.row_index),
      );
      setRows((current) =>
        current.filter((row) => failingIndexes.has(row.row_index)),
      );
      if (response.created > 0) {
        toast.warning(
          t("toasts.commitPartial", {
            created: response.created,
            failed: response.errors.length,
          }),
        );
      } else {
        toast.error(t("toasts.commitError"));
      }
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
  }, [commit, rows, router, t]);

  if (!canWrite) {
    return (
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">
        {t("fallback.forbidden")}
      </p>
    );
  }

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
            busy={parse.isPending}
            errorMessage={parseError}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {parserNotes ? (
            <div
              className="rounded-[14px] border px-4 py-3 text-[12.5px] leading-[1.5]"
              style={{
                background:
                  "color-mix(in oklab, var(--status-info) 8%, var(--orion-surface))",
                borderColor:
                  "color-mix(in oklab, var(--status-info) 25%, var(--orion-surface))",
                color: "var(--status-info)",
              }}
            >
              <strong className="mr-1.5 font-semibold">
                {t("preview.notes")}
              </strong>
              {parserNotes}
            </div>
          ) : null}

          {commitErrors.length > 0 ? (
            <ImportErrorList errors={commitErrors} />
          ) : null}

          {rows.length === 0 ? (
            <div className="rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
              {t("preview.empty")}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
              <div className="flex items-center justify-between border-b border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-serif text-[15px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
                    {t("preview.title")}
                  </span>
                  <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">
                    {t("preview.editHint")}
                  </span>
                </div>
                <span className="text-[12px] text-[color:var(--orion-ink-3)]">
                  {t("preview.totalRows", { count: rows.length })}
                </span>
              </div>
              <ImportPreviewTable
                rows={rows}
                errorsByIndex={errorsByIndex}
                onUpdate={handleUpdateRow}
                onRemove={handleRemoveRow}
              />
              <div className="flex items-center justify-between border-t border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)] px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  className="h-auto gap-2 rounded-[6px] px-[13px] py-[7px] text-[13px] text-[color:var(--orion-ink-2)] hover:bg-[color:var(--orion-surface-2)]"
                >
                  <ArrowLeft size={13} strokeWidth={1.8} />
                  {t("preview.back")}
                </Button>
                <Button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={rows.length === 0 || commit.isPending}
                  className="h-auto gap-2 rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:opacity-70"
                  style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
                >
                  <FileUp size={13} strokeWidth={1.8} />
                  {t("preview.commit")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ImportCommitDialog
        open={confirming}
        onOpenChange={setConfirming}
        rowCount={rows.length}
        isPending={commit.isPending}
        onConfirm={handleConfirmCommit}
      />
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const t = useTranslations("ordersImport.steps");
  const items: { id: Step; label: string }[] = [
    { id: "drop", label: t("drop") },
    { id: "review", label: t("review") },
    { id: "commit", label: t("commit") as string },
  ];
  // "commit" is a virtual step — the dialog. The indicator highlights
  // up through the current real step.
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
