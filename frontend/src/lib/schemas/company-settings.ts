/**
 * Zod schemas for the company catalog configuration + low-stock thresholds.
 * Mirrors backend/src/schemas/company_settings.py (the single `config` JSONB
 * blob persisted per tenant). Field names are camelCase exactly as on the wire.
 */

import { z } from "zod";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const SKU_PREFIX_RE = /^[A-Z0-9]{1,4}$/;

/** A material/ink color — `{ hex, name }`. */
export const colorEntrySchema = z.object({
  hex: z.string().regex(HEX_RE, { message: "validation.hex" }),
  name: z.string().min(1, { message: "validation.required" }).max(60),
});
export type ColorEntry = z.infer<typeof colorEntrySchema>;

/** A garment type (modelagem) — icon + label + SKU prefix. */
export const garmentTypeEntrySchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1, { message: "validation.required" }).max(60),
  skuPrefix: z.string().regex(SKU_PREFIX_RE, { message: "validation.skuPrefix" }),
  icon: z.string().min(1).max(40),
});
export type GarmentTypeEntry = z.infer<typeof garmentTypeEntrySchema>;

/** Allowed threshold units across all tiers. Per-tier subsets are enforced in UI. */
export const STOCK_THRESHOLD_UNITS = ["pct", "qty", "kg", "m"] as const;
export type StockThresholdUnit = (typeof STOCK_THRESHOLD_UNITS)[number];
export const stockThresholdUnitSchema = z.enum(STOCK_THRESHOLD_UNITS);

export const stockThresholdSchema = z.object({
  enabled: z.boolean(),
  unit: stockThresholdUnitSchema,
  value: z.number().min(0),
});
export type StockThreshold = z.infer<typeof stockThresholdSchema>;

/** The five inventory tiers, keyed exactly as the backend expects. */
export const STOCK_TIER_IDS = ["fabric", "paper", "blank", "printed", "product"] as const;
export type StockTierId = (typeof STOCK_TIER_IDS)[number];

export const stockThresholdsSchema = z.object({
  fabric: stockThresholdSchema,
  paper: stockThresholdSchema,
  blank: stockThresholdSchema,
  printed: stockThresholdSchema,
  product: stockThresholdSchema,
});
export type StockThresholds = z.infer<typeof stockThresholdsSchema>;

export const companySettingsConfigSchema = z.object({
  productColors: z.array(colorEntrySchema),
  printColors: z.array(colorEntrySchema),
  sizes: z.array(z.string().min(1)),
  fabricTypes: z.array(z.string().min(1)),
  garmentTypes: z.array(garmentTypeEntrySchema),
  aviamentos: z.array(z.string().min(1)),
  techniques: z.array(z.string().min(1)),
  stockThresholds: stockThresholdsSchema,
});
export type CompanySettingsConfig = z.infer<typeof companySettingsConfigSchema>;

export const companySettingsReadSchema = z.object({
  config: companySettingsConfigSchema,
});
export type CompanySettings = z.infer<typeof companySettingsReadSchema>;

export const companySettingsUpdateSchema = z.object({
  config: companySettingsConfigSchema,
});
export type CompanySettingsUpdate = z.infer<typeof companySettingsUpdateSchema>;

/**
 * Client-side fallback used while the GET is in flight (the backend seeds an
 * identical default on first read). Mirrors `DEFAULT_CONFIG` in
 * backend/src/services/company_settings.py and CATALOG_CONFIG_DEFAULTS in
 * docs/design/data.js.
 */
export const DEFAULT_CATALOG_CONFIG: CompanySettingsConfig = {
  productColors: [
    { hex: "#1f1f1f", name: "Preto" },
    { hex: "#f4f1ea", name: "Off-white" },
    { hex: "#7a4b2a", name: "Marrom" },
    { hex: "#c9b9a3", name: "Areia" },
    { hex: "#cfb98e", name: "Bege" },
    { hex: "#7a8a76", name: "Verde-musgo" },
    { hex: "#3a4a3d", name: "Verde escuro" },
    { hex: "#6b4a2e", name: "Caramelo" },
    { hex: "#b03a2e", name: "Vermelho" },
    { hex: "#2a3b5a", name: "Azul-marinho" },
  ],
  printColors: [
    { hex: "#f4f1ea", name: "Branco" },
    { hex: "#1f1f1f", name: "Preto" },
    { hex: "#efe6d3", name: "Off-white" },
    { hex: "#b03a2e", name: "Vermelho" },
    { hex: "#3a4a3d", name: "Verde escuro" },
    { hex: "#cfb98e", name: "Bege" },
    { hex: "#2a3b5a", name: "Azul-marinho" },
  ],
  sizes: ["P", "M", "G", "GG", "U"],
  fabricTypes: [
    "Algodão 30.1",
    "Algodão 24.1 penteado",
    "Malha PV (67/33)",
    "Malha 100% poliéster",
    "Moletom flanelado",
    "Sarja crua",
    "Linho misto",
    "Piquet algodão",
  ],
  garmentTypes: [
    { id: "camiseta", label: "Camiseta", skuPrefix: "CAM", icon: "camiseta" },
    { id: "moletom", label: "Moletom", skuPrefix: "MOL", icon: "moletom" },
    { id: "regata", label: "Regata", skuPrefix: "REG", icon: "regata" },
    { id: "blusa", label: "Blusa", skuPrefix: "BLU", icon: "blusa" },
    { id: "calca", label: "Calça", skuPrefix: "CAL", icon: "calca" },
    { id: "bermuda", label: "Bermuda", skuPrefix: "BER", icon: "bermuda" },
  ],
  aviamentos: [
    "Etiqueta interna tecida",
    "Etiqueta de composição",
    "Etiqueta externa estampada",
    "Tag de papel",
    "Lacre/sigilo",
    "Cordão capuz",
    "Zíper",
    "Botão",
    "Cadarço",
    "Elástico",
  ],
  techniques: ["DTF", "Silkscreen", "Sublimação"],
  stockThresholds: {
    fabric: { enabled: true, unit: "pct", value: 25 },
    paper: { enabled: true, unit: "pct", value: 25 },
    blank: { enabled: true, unit: "qty", value: 20 },
    printed: { enabled: true, unit: "qty", value: 10 },
    product: { enabled: true, unit: "qty", value: 10 },
  },
};

/** Per-tier allowed units + the suggested default value when switching unit. */
export const STOCK_TIER_UNITS: Record<
  StockTierId,
  { units: readonly StockThresholdUnit[]; defaults: Partial<Record<StockThresholdUnit, number>> }
> = {
  fabric: { units: ["pct", "kg"], defaults: { pct: 25, kg: 5 } },
  paper: { units: ["pct", "m"], defaults: { pct: 25, m: 30 } },
  blank: { units: ["qty"], defaults: { qty: 20 } },
  printed: { units: ["qty"], defaults: { qty: 10 } },
  product: { units: ["qty"], defaults: { qty: 10 } },
};
