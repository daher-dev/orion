import { Gauge, Building2, Users, LayoutGrid, PlugZap, type LucideIcon } from "lucide-react";

export type ConsoleNavItem = {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  color: string;
};

export type ConsoleNavSection = {
  titleKey?: string;
  items: ConsoleNavItem[];
};

// Mirrors CONSOLE_NAV in /docs/design/admin/shell.jsx.
export const consoleNav: ConsoleNavSection[] = [
  {
    items: [{ href: "/console", icon: Gauge, labelKey: "console.nav.overview", color: "var(--console-accent)" }],
  },
  {
    titleKey: "console.nav.platform",
    items: [
      { href: "/console/organizations", icon: Building2, labelKey: "console.nav.organizations", color: "#2563eb" },
      { href: "/console/users", icon: Users, labelKey: "console.nav.users", color: "#0f766e" },
      { href: "/console/plans", icon: LayoutGrid, labelKey: "console.nav.plans", color: "#7e5bef" },
      { href: "/console/integrations", icon: PlugZap, labelKey: "console.nav.integrations", color: "#c2410c" },
    ],
  },
];
