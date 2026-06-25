import {
  BarChart3,
  Check,
  ClipboardCheck,
  Circle,
  Download,
  Factory,
  FileText,
  ImageIcon,
  Key,
  Layers,
  LayoutDashboard,
  Mail,
  Package,
  PackageCheck,
  Palette,
  Printer,
  Radar,
  ScanLine,
  Scissors,
  Shield,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  Users,
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
  sparkles: Sparkles,
  users: Users,
  // flow icons
  download: Download,
  "clipboard-check": ClipboardCheck,
  wrench: Wrench,
  truck: Truck,
  layers: Layers,
  "scan-line": ScanLine,
  "package-check": PackageCheck,
  package: Package,
  scissors: Scissors,
  factory: Factory,
  printer: Printer,
  tag: Tag,
  "bar-chart-3": BarChart3,
  key: Key,
  shield: Shield,
  mail: Mail,
  // chrome
  check: Check,
  image: ImageIcon,
};

export function releaseIcon(name: string): LucideIcon {
  return RELEASE_ICONS[name] ?? Circle;
}
