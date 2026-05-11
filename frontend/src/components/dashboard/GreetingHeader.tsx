"use client";

import { LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHead } from "@/components/page/PageHead";
import { useMe } from "@/hooks/use-me";

function periodKey(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

export function GreetingHeader() {
  const t = useTranslations("dashboard");
  const { data } = useMe();
  const firstName = (data?.user?.display_name ?? data?.user?.name ?? data?.user?.email ?? "")
    .split(/\s+/)[0];
  const hour = new Date().getHours();
  const period = periodKey(hour);

  return (
    <PageHead
      subColor="var(--sidebar-primary)"
      mark={<LayoutDashboard size={11} strokeWidth={2.2} />}
      eyebrow={t("eyebrow")}
      title={
        firstName
          ? t(`greetings.${period}WithName`, { name: firstName })
          : t(`greetings.${period}`)
      }
      sub={t("sub")}
    />
  );
}
