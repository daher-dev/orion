import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Megaphone,
  Shirt,
  FileText,
  Palette,
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
 * Navigation tree for the sidebar. One node per route, grouped into sections.
 *
 * - `labelKey` and `titleKey` are next-intl translation keys (under `nav.*`).
 * - `permission` is an optional backend permission code; when present, the
 *   item is hidden for users that don't hold it.
 * - `subColor` is the CSS variable name for the sub-product color shown as a
 *   3px left bar when the item is active (and hinted on hover).
 * - `href` is the locale-relative path. Sidebar uses `Link` from
 *   `@/i18n/routing` so locale prefixing is automatic.
 *
 * Top-level items (no section) appear first or after the section list,
 * controlled via the `topLevel` array. Sections render between them.
 */

export type NavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  permission?: string;
  subColor?: string;
  /**
   * Optional pill count rendered next to the label (e.g. open orders).
   * Renders the `.sb-count` chip from the design source when set. Leave
   * undefined to hide. Counts are intended to be wired to live data via
   * lightweight hooks; the NavConfig itself doesn't know how to fetch.
   */
  count?: number;
};

export type NavSection = {
  titleKey: string;
  items: NavItem[];
};

export const dashboardItem: NavItem = {
  href: "/",
  icon: LayoutDashboard,
  labelKey: "nav.dashboard",
  subColor: "var(--sidebar-primary)",
};

export const navSections: NavSection[] = [
  {
    titleKey: "nav.sections.sales",
    items: [
      {
        href: "/orders",
        icon: ShoppingBag,
        labelKey: "nav.orders",
        permission: "orders.read",
        subColor: "var(--brand-sales)",
      },
      {
        href: "/orders/batches",
        icon: Package,
        labelKey: "nav.batches",
        permission: "orders.read",
        subColor: "var(--brand-sales)",
      },
      {
        href: "/clients",
        icon: Users,
        labelKey: "nav.clients",
        permission: "clients.read",
        subColor: "var(--brand-sales)",
      },
      {
        href: "/ads",
        icon: Megaphone,
        labelKey: "nav.ads",
        permission: "ads.read",
        subColor: "var(--brand-sales)",
      },
    ],
  },
  {
    titleKey: "nav.sections.catalog",
    items: [
      {
        href: "/products",
        icon: Shirt,
        labelKey: "nav.products",
        permission: "products.read",
        subColor: "var(--brand-catalog)",
      },
      {
        href: "/specs",
        icon: FileText,
        labelKey: "nav.specs",
        permission: "specs.read",
        subColor: "var(--brand-catalog)",
      },
      {
        href: "/prints",
        icon: Palette,
        labelKey: "nav.prints",
        permission: "prints.read",
        subColor: "var(--brand-catalog)",
      },
    ],
  },
  {
    titleKey: "nav.sections.production",
    items: [
      {
        href: "/cutting",
        icon: Scissors,
        labelKey: "nav.cutting",
        permission: "cutting.read",
        subColor: "var(--brand-prod)",
      },
      {
        href: "/sewing",
        icon: Send,
        labelKey: "nav.sewing",
        permission: "sewing.read",
        subColor: "var(--brand-prod)",
      },
      {
        href: "/contractors",
        icon: Factory,
        labelKey: "nav.contractors",
        permission: "contractors.read",
        subColor: "var(--brand-prod)",
      },
    ],
  },
  {
    titleKey: "nav.sections.inventory",
    items: [
      {
        href: "/fabric",
        icon: Layers,
        labelKey: "nav.fabric",
        permission: "fabric.read",
        subColor: "var(--brand-inv)",
      },
      {
        href: "/stock",
        icon: Boxes,
        labelKey: "nav.stock",
        permission: "stock.read",
        subColor: "var(--brand-inv)",
      },
    ],
  },
];

/**
 * Standalone items rendered at the bottom of the sidebar (after sections),
 * not under any section header. Per design: Relatórios + Ajustes.
 */
export const bottomItems: NavItem[] = [
  {
    // No permission requirement yet — `reports.read` lands with F-015. The
    // page itself is a placeholder until then; nav visibility matches design.
    href: "/reports",
    icon: BarChart3,
    labelKey: "nav.reports",
    subColor: "var(--brand-reports)",
  },
  {
    // Settings is always visible — sub-routes inside settings enforce their
    // own permissions when those features land.
    href: "/settings",
    icon: Settings,
    labelKey: "nav.settings",
    subColor: "var(--brand-settings)",
  },
];
