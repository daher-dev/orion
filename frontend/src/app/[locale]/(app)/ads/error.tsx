"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdsError({ reset }: Props) {
  const t = useTranslations("common");
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-serif text-[20px] font-medium text-[color:var(--orion-ink)]">
        {t("error")}
      </h2>
      <Button onClick={() => reset()}>{t("next")}</Button>
    </div>
  );
}
