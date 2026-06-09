"use client";

import { useRef, useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useScanCheck } from "@/hooks/use-separation";
import type { ApiError } from "@/lib/api-client";

/**
 * Scan-to-check bar — a text input that POSTs the scanned `tracking_code` to
 * `/v1/orders/separation/scan` on Enter (a hardware scanner types the code and
 * presses Enter), then re-focuses for the next bip. Shows toast feedback for
 * checked / already-checked / unknown / still-pending pieces.
 *
 * Mirrors the design's "bipe o QR de cada etiqueta" check-out flow.
 */
type Props = {
  /** Called with the checked order_id so the parent can refresh that row. */
  onChecked?: (orderId: string) => void;
};

export function ScanCheckBar({ onChecked }: Props) {
  const t = useTranslations("separation.scan");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scan = useScanCheck();

  const submit = () => {
    const code = value.trim();
    if (!code || scan.isPending) return;
    scan.mutate(
      { tracking_code: code },
      {
        onSuccess: (data) => {
          if (data.already_checked) {
            toast.info(t("toast.alreadyChecked", { code }));
          } else {
            toast.success(
              t("toast.checked", {
                index: data.item_index,
                total: data.total_items,
              }),
            );
          }
          onChecked?.(data.order_id);
          setValue("");
          inputRef.current?.focus();
        },
        onError: (err: ApiError) => {
          if (err.status === 404) toast.error(t("toast.unknown", { code }));
          else if (err.status === 409) toast.error(t("toast.notPrinted", { code }));
          else toast.error(t("toast.error"));
          setValue("");
          inputRef.current?.focus();
        },
      },
    );
  };

  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-3 py-2.5">
      <ScanLine
        size={18}
        className="flex-shrink-0 text-[color:var(--brand-sales)]"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t("placeholder")}
        aria-label={t("placeholder")}
        className="h-9 flex-1 font-mono text-[13px]"
        autoComplete="off"
        spellCheck={false}
      />
      {scan.isPending ? (
        <Loader2
          className="h-4 w-4 flex-shrink-0 animate-spin text-[color:var(--orion-ink-3)]"
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
