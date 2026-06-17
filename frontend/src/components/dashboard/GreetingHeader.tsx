"use client";

import type { ReactNode } from "react";
import { ClipboardCheck, Download, Factory, LayoutDashboard, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHead } from "@/components/page/PageHead";
import { helpBodyTags } from "@/components/page/help-tags";
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
  const firstName = (data?.user?.name ?? data?.user?.email ?? "")
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
      help={{
        icon: ClipboardCheck,
        maxW: 720,
        title: t("help.title"),
        body: t.rich("help.body", helpBodyTags),
        steps: [
          { icon: Download, label: t("help.flow.orders"), sub: t("help.flow.ordersSub") },
          { icon: ClipboardCheck, label: t("help.flow.check"), sub: t("help.flow.checkSub"), tone: "accent" },
          { icon: Factory, label: t("help.flow.production"), sub: t("help.flow.productionSub") },
          { icon: Truck, label: t("help.flow.ship"), sub: t("help.flow.shipSub"), tone: "ok" },
        ],
      }}
      actions={actions}
    />
  );
}
