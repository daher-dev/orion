"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { File as FileIcon, Loader2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  MAX_IMPORT_BYTES,
  isAcceptedUpload,
} from "@/lib/schemas/orders-import";

type Props = {
  /** Fired when the user clicks "Analisar" / "Analyze" with the chosen file. */
  onAnalyze: (file: File) => void;
  /** When true the dropzone shows a spinner and disables interaction. */
  busy?: boolean;
  /** Optional error message to render below the dropzone. */
  errorMessage?: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Drop-zone card — direct port of the design's drop area used in the
 * Import modal of /docs/design/source/pages/sales.jsx. Accepts a .pdf
 * or .csv up to MAX_IMPORT_BYTES (5 MB, mirroring the backend cap).
 *
 * Layout matches `.card` + dashed border: rounded 14px, surface bg,
 * line-soft dashed border, padding 32-40, centered icon + copy + CTA.
 */
export function ImportDropZone({ onAnalyze, busy = false, errorMessage }: Props) {
  const t = useTranslations("ordersImport");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setLocalError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const acceptFile = useCallback(
    (candidate: File) => {
      if (!isAcceptedUpload(candidate)) {
        setLocalError(t("dropzone.errorType"));
        setFile(null);
        return;
      }
      if (candidate.size > MAX_IMPORT_BYTES) {
        setLocalError(t("dropzone.errorSize"));
        setFile(null);
        return;
      }
      setLocalError(null);
      setFile(candidate);
    },
    [t],
  );

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const chosen = event.target.files?.[0];
      if (chosen) acceptFile(chosen);
    },
    [acceptFile],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (busy) return;
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) acceptFile(dropped);
    },
    [acceptFile, busy],
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (busy) return;
      setIsDragging(true);
    },
    [busy],
  );

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const error = errorMessage ?? localError;

  return (
    <div className="flex flex-col gap-3">
      {/* The dropzone itself — dashed border, surface bg, centered stack. */}
      <div
        data-testid="import-dropzone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className="flex flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed bg-[color:var(--orion-surface)] px-6 py-12 text-center transition-colors"
        style={{
          borderColor: isDragging
            ? "var(--brand-sales)"
            : "color-mix(in oklab, var(--brand-sales) 35%, var(--orion-line))",
          background: isDragging
            ? "color-mix(in oklab, var(--brand-sales) 6%, var(--orion-surface))"
            : "var(--orion-surface)",
        }}
      >
        <div
          className="grid h-12 w-12 place-items-center rounded-[14px]"
          style={{
            background: "color-mix(in oklab, var(--brand-sales) 12%, var(--orion-surface))",
            color: "var(--brand-sales)",
          }}
        >
          <Upload size={22} strokeWidth={1.6} />
        </div>

        {file ? (
          <div className="flex items-center gap-2 rounded-[8px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] px-3 py-2">
            <FileIcon size={14} className="text-[color:var(--brand-sales)]" />
            <span className="text-[13px] font-medium text-[color:var(--orion-ink)]">
              {file.name}
            </span>
            <span className="text-[12px] text-[color:var(--orion-ink-3)]">
              {formatBytes(file.size)}
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              aria-label={t("dropzone.removeFile")}
              className="ml-1 inline-grid h-5 w-5 place-items-center rounded-full text-[color:var(--orion-ink-3)] hover:bg-[color:var(--orion-surface-2)] hover:text-[color:var(--orion-ink)] disabled:opacity-50"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <h3 className="font-serif text-[18px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
              {t("dropzone.title")}
            </h3>
            <p className="max-w-[420px] text-[13px] leading-[1.5] text-[color:var(--orion-ink-3)]">
              {t("dropzone.body")}
            </p>
            <p className="text-[12px] text-[color:var(--orion-ink-3)]">
              {t("dropzone.acceptedTypes")}
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv,application/vnd.ms-excel"
          className="sr-only"
          onChange={onInputChange}
          disabled={busy}
        />

        <div className="mt-1 flex items-center gap-2">
          {!file ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="h-auto gap-2 rounded-[6px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] hover:bg-[color:var(--orion-surface-2)]"
            >
              <FileIcon size={13} strokeWidth={1.8} />
              {t("dropzone.pickFile")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => file && onAnalyze(file)}
              disabled={busy}
              className="h-auto gap-2 rounded-[6px] border bg-[color:var(--brand-sales)] px-[13px] py-[7px] text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(31,27,21,0.08)] hover:brightness-95 disabled:opacity-70"
              style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  {t("dropzone.parsing")}
                </>
              ) : (
                <>
                  <Upload size={13} strokeWidth={1.8} />
                  {t("dropzone.ctaParse")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="text-[12.5px] text-[color:var(--status-err)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
