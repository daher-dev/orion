"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { AuditResourceType } from "@/lib/schemas/audit-log";

/**
 * Coloured chip for a row's ``resource_type`` value.
 *
 * Mirrors the design's `.pill` token (used in `/docs/design/source/styles.css`):
 *
 *   - inline-flex, gap 5px, padding 2px 8px, radius 999px, 11.5px /500/.
 *   - bg = ~10% of the brand tone mixed with the surface; text = the brand
 *     tone; border = ~22% mix.
 *
 * The colour palette maps each resource group to a sub-product brand:
 *
 *   - Sales rows (orders, ads, clients) → terracotta (`--brand-sales`).
 *   - Catalog rows (products, specs, prints, trims) → aubergine
 *     (`--brand-catalog`).
 *   - Production rows (sewing, contractors) → teal (`--brand-prod`).
 *   - Inventory rows (fabric, cutting, stock) → amber (`--brand-inv`).
 *   - Settings rows (users, roles, permissions, invites, companies) →
 *     stone (`--brand-settings`).
 *
 * Unknown values fall back to stone, matching the Settings sub-product
 * (where this list view lives).
 */

const COLOR_MAP: Record<string, string> = {
  // Sales
  orders: "var(--brand-sales)",
  ads: "var(--brand-sales)",
  clients: "var(--brand-sales)",
  // Catalog
  products: "var(--brand-catalog)",
  product_variations: "var(--brand-catalog)",
  product_specs: "var(--brand-catalog)",
  spec_trims: "var(--brand-catalog)",
  print_designs: "var(--brand-catalog)",
  // Production
  sewing_contractors: "var(--brand-prod)",
  sewing_shipments: "var(--brand-prod)",
  sewing_shipment_items: "var(--brand-prod)",
  // Inventory
  fabric_rolls: "var(--brand-inv)",
  cutting_orders: "var(--brand-inv)",
  cutting_order_outputs: "var(--brand-inv)",
  stock_entries: "var(--brand-inv)",
  stock_exits: "var(--brand-inv)",
  // Settings
  companies: "var(--brand-settings)",
  users: "var(--brand-settings)",
  roles: "var(--brand-settings)",
  permissions: "var(--brand-settings)",
  invites: "var(--brand-settings)",
};

export type ResourceTypeChipProps = {
  resourceType: string;
};

export function ResourceTypeChip({ resourceType }: ResourceTypeChipProps) {
  const t = useTranslations("audit.resourceTypes");
  // Known types come from the seed catalog; unknown ones simply render
  // the raw string with the stone fallback colour.
  const label = isKnown(resourceType) ? t(resourceType as AuditResourceType) : resourceType;
  const color = COLOR_MAP[resourceType] ?? "var(--brand-settings)";

  return (
    <span
      data-resource-type={resourceType}
      // Mirrors `.pill` from design — line-height 1.5 keeps the chip 22px
      // tall, in line with the surrounding table row metrics.
      className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[11.5px] font-medium leading-[1.5] whitespace-nowrap"
      style={
        {
          "--chip-color": color,
          color: "var(--chip-color)",
          background: "color-mix(in oklab, var(--chip-color) 10%, var(--orion-surface))",
          borderColor: "color-mix(in oklab, var(--chip-color) 25%, var(--orion-surface))",
        } as CSSProperties
      }
    >
      <span
        // .pill-dot — 6×6 currentColor circle anchoring the chip.
        className="size-[6px] shrink-0 rounded-full"
        style={{ background: "currentColor" }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function isKnown(value: string): boolean {
  return value in COLOR_MAP;
}
