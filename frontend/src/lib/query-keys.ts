/**
 * Centralized TanStack Query key factory.
 *
 * Conventions
 * - Every domain exposes `all()`, `lists()`, `list(filters)`, `detail(id)` shapes.
 * - All keys are `as const` arrays so TanStack's invalidation matchers narrow correctly.
 * - Feature agents only ADD inside their namespace — keep this file conflict-light.
 */

const tuple = <T extends readonly unknown[]>(...items: T) => items;

export const qk = {
  auth: {
    me: () => tuple("auth", "me"),
  },
  orders: {
    all: () => tuple("orders"),
    lists: () => tuple("orders", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("orders", "list", filters),
    detail: (id: string) => tuple("orders", "detail", id),
    /** Per-piece separation items for one order (Separação). */
    items: (orderId: string) => tuple("orders", "items", orderId),
  },
  batches: {
    all: () => tuple("batches"),
    lists: () => tuple("batches", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("batches", "list", filters),
    detail: (id: string) => tuple("batches", "detail", id),
  },
  mapping: {
    all: () => tuple("mapping"),
    lists: () => tuple("mapping", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("mapping", "list", filters),
  },
  clients: {
    all: () => tuple("clients"),
    lists: () => tuple("clients", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("clients", "list", filters),
    detail: (id: string) => tuple("clients", "detail", id),
  },
  ads: {
    all: () => tuple("ads"),
    lists: () => tuple("ads", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("ads", "list", filters),
    detail: (id: string) => tuple("ads", "detail", id),
  },
  products: {
    all: () => tuple("products"),
    lists: () => tuple("products", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("products", "list", filters),
    detail: (id: string) => tuple("products", "detail", id),
  },
  specs: {
    all: () => tuple("specs"),
    lists: () => tuple("specs", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("specs", "list", filters),
    detail: (id: string) => tuple("specs", "detail", id),
  },
  prints: {
    all: () => tuple("prints"),
    lists: () => tuple("prints", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("prints", "list", filters),
    detail: (id: string) => tuple("prints", "detail", id),
  },
  fabric: {
    all: () => tuple("fabric"),
    lists: () => tuple("fabric", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("fabric", "list", filters),
    detail: (id: string) => tuple("fabric", "detail", id),
    movements: (filters: Readonly<Record<string, unknown>> = {}) =>
      tuple("fabric", "movements", filters),
  },
  cutting: {
    all: () => tuple("cutting"),
    lists: () => tuple("cutting", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("cutting", "list", filters),
    detail: (id: string) => tuple("cutting", "detail", id),
    cost: (id: string) => tuple("cutting", "cost", id),
    available: (filters: Readonly<Record<string, unknown>> = {}) =>
      tuple("cutting", "available", filters),
  },
  sewing: {
    all: () => tuple("sewing"),
    lists: () => tuple("sewing", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("sewing", "list", filters),
    detail: (id: string) => tuple("sewing", "detail", id),
  },
  printOrders: {
    all: () => tuple("print-orders"),
    lists: () => tuple("print-orders", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("print-orders", "list", filters),
    detail: (id: string) => tuple("print-orders", "detail", id),
  },
  assembly: {
    all: () => tuple("assembly"),
    buildable: (filters: Readonly<Record<string, unknown>> = {}) => tuple("assembly", "buildable", filters),
  },
  planning: {
    all: () => tuple("planning"),
    suggestions: () => tuple("planning", "suggestions"),
  },
  contractors: {
    all: () => tuple("contractors"),
    lists: () => tuple("contractors", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("contractors", "list", filters),
    detail: (id: string) => tuple("contractors", "detail", id),
  },
  stock: {
    all: () => tuple("stock"),
    lists: () => tuple("stock", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("stock", "list", filters),
    detail: (id: string) => tuple("stock", "detail", id),
  },
  blankStock: {
    all: () => tuple("blank-stock"),
    lists: () => tuple("blank-stock", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("blank-stock", "list", filters),
    detail: (id: string) => tuple("blank-stock", "detail", id),
    levels: (filters: Readonly<Record<string, unknown>> = {}) => tuple("blank-stock", "levels", filters),
    movements: (filters: Readonly<Record<string, unknown>> = {}) =>
      tuple("blank-stock", "movements", filters),
  },
  paperRolls: {
    all: () => tuple("paper-rolls"),
    lists: () => tuple("paper-rolls", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("paper-rolls", "list", filters),
    detail: (id: string) => tuple("paper-rolls", "detail", id),
    levels: (filters: Readonly<Record<string, unknown>> = {}) => tuple("paper-rolls", "levels", filters),
    movements: (filters: Readonly<Record<string, unknown>> = {}) =>
      tuple("paper-rolls", "movements", filters),
  },
  printedTransfers: {
    all: () => tuple("printed-transfers"),
    lists: () => tuple("printed-transfers", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) =>
      tuple("printed-transfers", "list", filters),
    detail: (id: string) => tuple("printed-transfers", "detail", id),
    levels: (filters: Readonly<Record<string, unknown>> = {}) =>
      tuple("printed-transfers", "levels", filters),
    movements: (filters: Readonly<Record<string, unknown>> = {}) =>
      tuple("printed-transfers", "movements", filters),
  },
  audit: {
    all: () => tuple("audit"),
    lists: () => tuple("audit", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("audit", "list", filters),
  },
  members: {
    all: () => tuple("members"),
    lists: () => tuple("members", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("members", "list", filters),
    detail: (id: string) => tuple("members", "detail", id),
  },
  roles: {
    all: () => tuple("roles"),
    lists: () => tuple("roles", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("roles", "list", filters),
    detail: (id: string) => tuple("roles", "detail", id),
  },
  invites: {
    all: () => tuple("invites"),
    lists: () => tuple("invites", "list"),
    list: (filters: Readonly<Record<string, unknown>> = {}) => tuple("invites", "list", filters),
    detail: (id: string) => tuple("invites", "detail", id),
  },
  dashboard: {
    summary: (range?: Readonly<Record<string, unknown>>) => tuple("dashboard", "summary", range ?? {}),
  },
  reports: {
    all: () => tuple("reports"),
    one: (slug: string, params?: Readonly<Record<string, unknown>>) =>
      tuple("reports", slug, params ?? {}),
  },
  settings: {
    all: () => tuple("settings"),
    company: () => tuple("settings", "company"),
    profile: () => tuple("settings", "profile"),
    stockAlerts: () => tuple("settings", "stock-alerts"),
    catalog: () => tuple("settings", "catalog"),
  },
  billing: {
    all: () => tuple("billing"),
    summary: () => tuple("billing", "summary"),
  },
  integrations: {
    all: () => tuple("integrations"),
    channels: () => tuple("integrations", "channels"),
  },
  admin: {
    all: () => tuple("admin"),
    overview: () => tuple("admin", "overview"),
    organizations: () => tuple("admin", "organizations"),
    organization: (id: string) => tuple("admin", "organization", id),
    orgMembers: (id: string) => tuple("admin", "organization", id, "members"),
    operators: () => tuple("admin", "operators"),
    plans: () => tuple("admin", "plans"),
  },
} as const;

export type QueryKey = ReturnType<
  (typeof qk)[keyof typeof qk][keyof (typeof qk)[keyof typeof qk]]
>;
