"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronsUpDown, Link2, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrderChannelChip } from "@/components/orders/OrderChannelChip";
import { useAds } from "@/hooks/use-ads";
import { useProducts } from "@/hooks/use-products";
import { useUpsertSkuMapping } from "@/hooks/use-orders-import";
import { ApiError } from "@/lib/api-client";
import type { Ecommerce } from "@/lib/schemas/ad";
import type { UpsellerImportError } from "@/lib/schemas/orders-import";

/** One pinnable group: every unmatched line sharing a (marketplace, SKU). */
type SkuGroup = {
  key: string;
  marketplace: Ecommerce;
  sku: string;
  adTitle: string | null;
  variationText: string | null;
  imageUrl: string | null;
  message: string;
  count: number;
};

/**
 * Collapse the unmatched lines into one resolvable entry per marketplace SKU —
 * a single pin fixes every order line carrying that SKU. Lines without a SKU
 * can't be pinned via the De/Para and are counted separately.
 */
function groupErrors(errors: UpsellerImportError[]): {
  groups: SkuGroup[];
  unpinnable: number;
} {
  const map = new Map<string, SkuGroup>();
  let unpinnable = 0;
  for (const e of errors) {
    if (!e.sku || !e.marketplace) {
      unpinnable += 1;
      continue;
    }
    const key = `${e.marketplace}::${e.sku.toLowerCase()}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    map.set(key, {
      key,
      marketplace: e.marketplace,
      sku: e.sku,
      adTitle: e.ad_title ?? null,
      variationText: e.variation_text ?? null,
      imageUrl: e.image_url ?? null,
      message: e.message,
      count: 1,
    });
  }
  return { groups: [...map.values()], unpinnable };
}

type Props = {
  errors: UpsellerImportError[];
  /** Re-run the dry-run so the just-pinned SKUs fold back into the preview. */
  onResolved: () => void;
};

/**
 * In-import De/Para resolver. Each unmatched marketplace SKU gets an ad +
 * variation picker; confirming pins a `SkuMapping`, then the wizard re-analyzes
 * so the line resolves deterministically from here on — the unmatched queue is
 * a one-time, per-SKU cost rather than a per-import chore.
 */
export function ImportResolver({ errors, onResolved }: Props) {
  const t = useTranslations("ordersImport.resolver");
  const { groups, unpinnable } = useMemo(() => groupErrors(errors), [errors]);
  if (groups.length === 0 && unpinnable === 0) return null;

  return (
    <div
      data-testid="import-resolver"
      className="overflow-hidden rounded-[14px] border"
      style={{
        borderColor: "color-mix(in oklab, var(--status-err) 25%, var(--orion-line))",
      }}
    >
      <div
        className="flex flex-col gap-0.5 border-b px-4 py-3"
        style={{
          borderColor: "color-mix(in oklab, var(--status-err) 18%, var(--orion-line-soft))",
          background: "color-mix(in oklab, var(--status-err) 6%, var(--orion-surface))",
        }}
      >
        <div
          className="flex items-center gap-2 text-[13px] font-semibold"
          style={{ color: "var(--status-err)" }}
        >
          <Link2 size={14} strokeWidth={2} />
          {t("title")} · {groups.length}
        </div>
        <p className="text-[11.5px] leading-[1.5] text-[color:var(--orion-ink-3)]">
          {t("sub")}
        </p>
      </div>

      <div className="grid gap-2.5 p-3">
        {groups.map((group) => (
          <ResolverRow key={group.key} group={group} onResolved={onResolved} />
        ))}
      </div>

      {unpinnable > 0 ? (
        <div className="flex items-center gap-2 border-t border-[color:var(--orion-line-soft)] px-4 py-2.5 text-[11.5px] text-[color:var(--orion-ink-3)]">
          <Wrench size={12} className="flex-shrink-0" />
          {t("unpinnable", { count: unpinnable })}
        </div>
      ) : null}
    </div>
  );
}

function ResolverRow({
  group,
  onResolved,
}: {
  group: SkuGroup;
  onResolved: () => void;
}) {
  const t = useTranslations("ordersImport.resolver");
  const [resolvedSku, setResolvedSku] = useState<string | null>(null);
  const [adId, setAdId] = useState<string | null>(null);
  const [adOpen, setAdOpen] = useState(false);
  const [search, setSearch] = useState(group.adTitle ?? "");
  const [variationId, setVariationId] = useState<string>("");

  // Default the ad search to the line's ad title so the likely listing is one
  // keystroke away; server-side search drives the list (Command filter off).
  const adsQuery = useAds({ q: search.trim() || undefined, page_size: 20 });
  const ads = adsQuery.data?.items ?? [];
  const selectedAd = ads.find((a) => a.id === adId) ?? null;

  // The catalog (with variations) is one shared, cached request across rows.
  const productsQuery = useProducts({ page_size: 200 });
  const variations = useMemo(() => {
    if (!selectedAd) return [];
    const productIds = new Set(selectedAd.products.map((p) => p.id));
    return (productsQuery.data?.items ?? [])
      .filter((p) => productIds.has(p.id))
      .flatMap((p) => p.variations.map((v) => ({ ...v, productName: p.name })));
  }, [selectedAd, productsQuery.data]);

  const upsert = useUpsertSkuMapping();

  const onVincular = async () => {
    if (!adId || !variationId) return;
    try {
      const read = await upsert.mutateAsync({
        marketplace: group.marketplace,
        sku: group.sku,
        ad_id: adId,
        variation_id: variationId,
      });
      setResolvedSku(read.variation_sku ?? group.sku);
      toast.success(t("toast.linked", { sku: read.variation_sku ?? group.sku }));
      onResolved();
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.detail ? err.detail : t("toast.error"),
      );
    }
  };

  if (resolvedSku) {
    return (
      <div
        data-testid={`resolver-row-${group.key}`}
        className="flex items-center gap-2.5 rounded-[10px] border p-3"
        style={{
          background: "color-mix(in oklab, var(--status-ok) 6%, var(--orion-surface))",
          borderColor: "color-mix(in oklab, var(--status-ok) 30%, var(--orion-surface))",
        }}
      >
        <CheckCircle2 size={18} className="flex-shrink-0 text-[color:var(--status-ok)]" />
        <span className="font-mono text-[12px] text-[color:var(--orion-ink-2)]">
          {group.sku}
        </span>
        <span className="text-[12px] text-[color:var(--orion-ink-3)]">→</span>
        <span
          className="rounded-[5px] px-[7px] py-[2px] font-mono text-[11px] text-[color:var(--brand-sales)]"
          style={{ background: "color-mix(in oklab, var(--brand-sales) 10%, var(--orion-surface))" }}
        >
          {resolvedSku}
        </span>
        <span className="ml-auto text-[11.5px] text-[color:var(--status-ok)]">
          {t("linked")}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid={`resolver-row-${group.key}`}
      className="rounded-[10px] border border-[color:var(--orion-line)] p-3"
      style={{ background: "var(--orion-surface)" }}
    >
      <div className="flex items-start gap-3">
        {group.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={group.imageUrl}
            alt=""
            className="h-10 w-10 flex-shrink-0 rounded-[7px] object-cover"
            style={{ border: "1px solid var(--orion-line-soft)" }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <OrderChannelChip channel={group.marketplace} />
            <span className="font-mono text-[11px] text-[color:var(--orion-ink-3)]">
              {group.sku}
            </span>
            {group.count > 1 ? (
              <span className="text-[11px] text-[color:var(--orion-ink-3)]">
                · {t("lineCount", { count: group.count })}
              </span>
            ) : null}
          </div>
          {group.adTitle ? (
            <div className="mt-1 truncate text-[13px] font-medium text-[color:var(--orion-ink)]">
              {group.adTitle}
            </div>
          ) : null}
          {group.variationText ? (
            <span className="mt-1 inline-block rounded-[6px] border border-[color:var(--orion-line-soft)] bg-[color:var(--orion-surface-2)] px-2 py-[2px] text-[11.5px] text-[color:var(--orion-ink-2)]">
              {group.variationText}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Ad (listing) picker — searchable, defaults to the line's ad title. */}
        <Popover open={adOpen} onOpenChange={setAdOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              data-testid={`resolver-ad-${group.key}`}
              className="h-auto min-w-0 flex-1 justify-between rounded-[8px] border-[color:var(--orion-line)] py-2 text-[13px] font-normal"
            >
              <span className="truncate">
                {selectedAd ? selectedAd.title : t("chooseAd")}
              </span>
              <ChevronsUpDown size={13} className="ml-2 flex-shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={t("searchAd")}
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {adsQuery.isLoading ? null : (
                  <CommandEmpty>{t("noAds")}</CommandEmpty>
                )}
                <CommandGroup>
                  {ads.map((ad) => (
                    <CommandItem
                      key={ad.id}
                      value={ad.id}
                      onSelect={() => {
                        setAdId(ad.id);
                        setVariationId("");
                        setAdOpen(false);
                      }}
                      className="gap-2"
                    >
                      <Check
                        size={14}
                        className={
                          ad.id === adId ? "opacity-100" : "opacity-0"
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{ad.title}</span>
                      <OrderChannelChip channel={ad.ecommerce} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Variation picker — scoped to the chosen ad's products. */}
        <Select
          value={variationId}
          onValueChange={setVariationId}
          disabled={!selectedAd || variations.length === 0}
        >
          <SelectTrigger
            data-testid={`resolver-variation-${group.key}`}
            className="h-auto min-w-0 flex-1 rounded-[8px] border-[color:var(--orion-line)] py-2 text-[13px]"
          >
            <SelectValue placeholder={selectedAd ? t("chooseVariation") : t("pickAdFirst")} />
          </SelectTrigger>
          <SelectContent>
            {variations.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.productName} · {v.color} · {v.size.toUpperCase()} — {v.sku}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          onClick={onVincular}
          disabled={!adId || !variationId || upsert.isPending}
          data-testid={`resolver-link-${group.key}`}
          className="h-auto gap-1.5 rounded-[8px] border bg-[color:var(--brand-sales)] px-3 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ borderColor: "color-mix(in oklab, var(--brand-sales) 70%, black)" }}
        >
          <Link2 size={13} /> {t("link")}
        </Button>
      </div>
    </div>
  );
}
