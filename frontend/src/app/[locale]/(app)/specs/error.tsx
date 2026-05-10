"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error("[/specs] error boundary", error);
  }, [error]);
  return (
    <div className="rounded-xl border border-[color:var(--status-err)] bg-[color:var(--orion-surface)] p-6 text-[color:var(--status-err)]">
      <h2 className="font-serif text-[20px]">{t("error")}</h2>
      <p className="mt-2 text-[13px] text-[color:var(--orion-ink-3)]">{error.message}</p>
      <Button variant="outline" className="mt-3" onClick={reset}>
        {t("back")}
      </Button>
    </div>
  );
}
