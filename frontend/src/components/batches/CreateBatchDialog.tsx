"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/hooks/use-orders";
import { useCreateBatch } from "@/hooks/use-batches";
import { shortOrderCode } from "@/components/orders/OrdersTable";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateBatchDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("batches");
  const router = useRouter();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data, isPending } = useOrders({ unbatched: true, page_size: 100 });
  const create = useCreateBatch();
  const orders = data?.items ?? [];
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const reset = () => {
    setName("");
    setSelected({});
  };

  const submit = () => {
    if (selectedIds.length === 0) return;
    create.mutate(
      { order_ids: selectedIds, name: name.trim() || null },
      {
        onSuccess: (batch) => {
          toast.success(t("toast.created"));
          reset();
          onOpenChange(false);
          router.push(`/orders/batches/${batch.id}`);
        },
        onError: () => toast.error(t("list.loadError")),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            placeholder={t("create.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div>
            <p className="mb-1.5 text-[12px] font-medium text-[color:var(--orion-ink-2)]">
              {t("create.selectOrders")}
            </p>
            <div className="max-h-[320px] overflow-y-auto rounded-[8px] border border-[color:var(--orion-line)]">
              {isPending ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : orders.length === 0 ? (
                <p className="px-3 py-8 text-center text-[12.5px] text-[color:var(--orion-ink-3)]">
                  {t("create.noOrders")}
                </p>
              ) : (
                orders.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-[color:var(--orion-line-soft)] px-3 py-2 last:border-b-0 hover:bg-[color:var(--orion-bg)]"
                  >
                    <Checkbox
                      checked={!!selected[o.id]}
                      onCheckedChange={(v) =>
                        setSelected((s) => ({ ...s, [o.id]: !!v }))
                      }
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[12.5px] font-medium text-[color:var(--orion-ink)]">
                        {o.variation.product.name}
                      </span>
                      <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
                        {o.external_order_id ?? shortOrderCode(o.id)} · {o.variation.color}{" "}
                        {o.variation.size.toUpperCase()} · ×{o.quantity}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-[color:var(--orion-ink-3)]">
              {t("create.hint")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <span className="mr-auto self-center text-[12px] text-[color:var(--orion-ink-3)]">
            {t("create.selected", { count: selectedIds.length })}
          </span>
          <Button
            type="button"
            onClick={submit}
            disabled={selectedIds.length === 0 || create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {t("create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
