import {
  Check,
  ClipboardCheck,
  Circle,
  Download,
  FileText,
  ImageIcon,
  Layers,
  LayoutDashboard,
  PackageCheck,
  Palette,
  Radar,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Resolve the lucide icon names used by release data (src/data/releases.ts) and
 * the Novidades UI to their components. Kept to the exact set we reference so
 * we don't pull the whole lucide barrel into the bundle. Unknown names fall
 * back to a neutral circle.
 */
const RELEASE_ICONS: Record<string, LucideIcon> = {
  // area icons
  "layout-dashboard": LayoutDashboard,
  palette: Palette,
  "shopping-bag": ShoppingBag,
  "file-text": FileText,
  radar: Radar,
  // flow icons
  download: Download,
  "clipboard-check": ClipboardCheck,
  wrench: Wrench,
  truck: Truck,
  layers: Layers,
  "scan-line": ScanLine,
  "package-check": PackageCheck,
  // chrome
  sparkles: Sparkles,
  check: Check,
  image: ImageIcon,
};

export function releaseIcon(name: string): LucideIcon {
  return RELEASE_ICONS[name] ?? Circle;
}
