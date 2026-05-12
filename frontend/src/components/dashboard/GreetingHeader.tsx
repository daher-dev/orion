"use client";

import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHead } from "@/components/page/PageHead";
import { useMe } from "@/hooks/use-me";

function periodKey(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

type Props = {
  actions?: ReactNode;
};

export function GreetingHeader({ actions }: Props) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { data } = useMe();
  const firstName = (data?.user?.display_name ?? data?.user?.email ?? "")
    .split(/\s+/)[0];
  const hour = new Date().getHours();
  const period = periodKey(hour);

  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleDateString(locale, { month: "long" });

  return (
    <PageHead
      subColor="var(--sidebar-primary)"
      mark={<LayoutDashboard size={11} strokeWidth={2.2} />}
      eyebrow={t("eyebrow")}
      title={firstName ? `${t(`greetings.${period}`)},` : t(`greetings.${period}`)}
      titleEm={firstName || undefined}
      sub={t("sub", { day, month })}
      actions={actions}
    />
  );
}
