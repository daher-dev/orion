"use client";

import { useId, useRef } from "react";
import { CheckCircle2, ImageOff, Loader2, RefreshCw, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ArtworkStatus } from "@/lib/schemas/print";

type Props = {
  status: ArtworkStatus;
  fileUrl: string | null;
  label: string;
  uploading?: boolean;
  disabled?: boolean;
  onUpload: (file: File) => void;
  testId: string;
};

/**
 * One side (front/back) of a variation: art preview + status + real PNG upload.
 * The browser file picker is wired to a hidden <input type="file" accept="image/png">
 * that calls `onUpload(file)` — the caller posts it via the multipart artwork
 * endpoint. Port of `SidePngTile` from docs/design/pages/catalog.jsx.
 */
export function SidePngTile({
  status,
  fileUrl,
  label,
  uploading,
  disabled,
  onUpload,
  testId,
}: Props) {
  const t = useTranslations("prints.variations");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const ready = status === "ok";

  const pick = () => inputRef.current?.click();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same filename
    if (file) onUpload(file);
  };

  // Best-effort display name from the stored URL.
  const fileName = fileUrl ? decodeURIComponent(fileUrl.split("/").pop() ?? "") : "";

  return (
    <div
      className="min-w-0 flex-1 overflow-hidden rounded-[9px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface)]"
      data-testid={testId}
      data-status={status}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/png"
        className="hidden"
        disabled={disabled || uploading}
        onChange={handleFile}
        data-testid={`${testId}-input`}
      />
      <div className="relative">
        <div
          className={cn(
            "grid aspect-square place-items-center",
            ready
              ? "bg-[radial-gradient(circle_at_30%_30%,#f4d9b8,#c2410c)]"
              : "border-2 border-dashed border-[color:var(--orion-line)] bg-[color:var(--orion-surface-2)]",
          )}
        >
          {ready && fileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={label} className="size-full object-cover" />
          ) : (
            <ImageOff className="size-[18px] text-[color:var(--orion-ink-3)]" />
          )}
        </div>
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.04em] text-white">
          {label}
        </span>
      </div>
      <div className="px-2 py-[7px]">
        {uploading ? (
          <div className="flex items-center justify-center gap-1.5 py-[5px] text-[11.5px] text-[color:var(--orion-ink-3)]">
            <Loader2 className="size-3 animate-spin" /> {t("uploadPng")}
          </div>
        ) : ready ? (
          <div className="flex items-center gap-1">
            <CheckCircle2 className="size-3 shrink-0 text-[color:var(--status-ok)]" />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[color:var(--orion-ink-3)]">
              {fileName || t("pngOk")}
            </span>
            <button
              type="button"
              onClick={pick}
              disabled={disabled}
              title={t("replace")}
              data-testid={`${testId}-replace`}
              className="shrink-0 p-[3px] text-[color:var(--orion-ink-3)] hover:text-[color:var(--orion-ink)] disabled:opacity-40"
            >
              <RefreshCw className="size-[11px]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={pick}
            disabled={disabled}
            data-testid={`${testId}-upload`}
            className="flex w-full items-center justify-center gap-1.5 rounded-[6px] border border-[color:var(--status-warn)] px-1.5 py-[5px] text-[11.5px] font-medium text-[color:var(--status-warn)] disabled:opacity-40"
          >
            <UploadCloud className="size-3" /> {t("uploadPng")}
          </button>
        )}
      </div>
    </div>
  );
}
