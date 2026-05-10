import {
  ShoppingBag,
  Users,
  Megaphone,
  Shirt,
  Ruler,
  Image,
  Scissors,
  Send,
  Factory,
  Layers,
  Boxes,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

/**
 * Navigation tree for the sidebar. One node per route, grouped by section.
 *
 * - `labelKey` and `titleKey` are next-intl translation keys (under `nav.*`).
 * - `permission` is an optional backend permission code; when present, the
 *   item is hidden for users that don't hold it.
 * - `href` is the locale-relative path. Sidebar uses `Link` from
 *   `@/i18n/routing` so locale prefixing is automatic.
 */

export type NavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  permission?: string;
};

export type NavSection = {
  titleKey: string;
  items: NavItem[];
};

export const navSections: NavSection[] = [
  {
    titleKey: "nav.sections.sales",
    items: [
      { href: "/orders", icon: ShoppingBag, labelKey: "nav.orders", permission: "orders.read" },
      { href: "/clients", icon: Users, labelKey: "nav.clients", permission: "clients.read" },
      { href: "/ads", icon: Megaphone, labelKey: "nav.ads", permission: "ads.read" },
    ],
  },
  {
    titleKey: "nav.sections.catalog",
    items: [
      { href: "/products", icon: Shirt, labelKey: "nav.products", permission: "products.read" },
      { href: "/specs", icon: Ruler, labelKey: "nav.specs", permission: "specs.read" },
      { href: "/prints", icon: Image, labelKey: "nav.prints", permission: "prints.read" },
    ],
  },
  {
    titleKey: "nav.sections.production",
    items: [
      { href: "/cutting", icon: Scissors, labelKey: "nav.cutting", permission: "cutting.read" },
      { href: "/sewing", icon: Send, labelKey: "nav.sewing", permission: "sewing.read" },
      { href: "/contractors", icon: Factory, labelKey: "nav.contractors", permission: "contractors.read" },
    ],
  },
  {
    titleKey: "nav.sections.inventory",
    items: [
      { href: "/fabric", icon: Layers, labelKey: "nav.fabric", permission: "fabric.read" },
      { href: "/stock", icon: Boxes, labelKey: "nav.stock", permission: "stock.read" },
    ],
  },
  {
    titleKey: "nav.sections.insights",
    items: [
      { href: "/reports", icon: BarChart3, labelKey: "nav.reports", permission: "reports.read" },
    ],
  },
  {
    titleKey: "nav.sections.settings",
    items: [
      // Settings is always visible — sub-routes inside settings enforce their own perms.
      { href: "/settings", icon: Settings, labelKey: "nav.settings" },
    ],
  },
];
