"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { OrderFormSheet } from "@/components/orders/OrderFormSheet";
import { useCanAccess } from "@/hooks/use-permissions";

export default function NewOrderPage() {
  const t = useTranslations("orders");
  const router = useRouter();
  const canWrite = useCanAccess("orders.write");
  const [open, setOpen] = useState(true);

  if (!canWrite) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-[color:var(--orion-ink-3)]">
          {t("fallback.forbidden")}
        </p>
        <Link
          href="/orders"
          className="text-[12px] text-[color:var(--brand-sales)] underline"
        >
          {t("actions.back")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <OrderFormSheet
        open={open}
        navigateOnCreate
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) router.push("/orders");
        }}
      />
    </div>
  );
}
