import { z } from "zod";

export const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const companyReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  subdomain: z.string(),
  main_color: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const companyUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  main_color: z
    .string()
    .regex(hexColorRegex, "Invalid color")
    .optional(),
});

export type CompanyRead = z.infer<typeof companyReadSchema>;
export type CompanyUpdate = z.infer<typeof companyUpdateSchema>;

/**
 * Six brand presets used in the Settings company color picker. The order
 * mirrors the design source's swatch row (indigo first; ink last).
 */
export const colorPresets = [
  { id: "indigo", hex: "#2563eb" },
  { id: "terracotta", hex: "#c2410c" },
  { id: "teal", hex: "#0f766e" },
  { id: "aubergine", hex: "#7e5bef" },
  { id: "amber", hex: "#b45309" },
  { id: "ink", hex: "#1f1b15" },
] as const;

export type ColorPresetId = (typeof colorPresets)[number]["id"];
