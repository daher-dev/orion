"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function StockError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error("[stock] page error", error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-3 rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] p-6">
      <h2 className="font-serif text-[18px] font-medium text-[color:var(--orion-ink)]">
        {t("error")}
      </h2>
      <p className="text-[13px] text-[color:var(--orion-ink-3)]">{error.message}</p>
      <Button
        onClick={reset}
        variant="outline"
        className="h-auto rounded-[6px] border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] !px-[13px] py-[7px] text-[13px] font-medium text-[color:var(--orion-ink)] shadow-none hover:bg-[color:var(--orion-surface-2)]"
      >
        {t("back")}
      </Button>
    </div>
  );
}
