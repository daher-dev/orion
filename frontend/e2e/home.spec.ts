import { test, expect, type Page, type Route } from "@playwright/test";

const MOCK_ME = {
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    name: "QA Dev User",
    email: "qa-dev@orion.local",
    is_operator: false,
  },
  company: {
    id: "22222222-2222-2222-2222-222222222222",
    name: "QA Co",
    subdomain: "qa-co",
    main_color: "#2563eb",
  },
  role: { id: "33333333-3333-3333-3333-333333333333", code: "admin", name: "Admin" },
  permissions: ["orders.read", "orders.write"],
  companies: [{ id: "22222222-2222-2222-2222-222222222222", name: "QA Co", role_code: "admin" }],
};

const MOCK_DASHBOARD = {
  kpis: {
    orders_pending: { label: "Pedidos", value: 0, delta_pct: null, sparkline: null },
    orders_revenue_30d: { label: "Receita", value: 0, delta_pct: null, sparkline: null },
    cutting_pending: { label: "Corte", value: 0, delta_pct: null, sparkline: null },
    stock_low: { label: "Estoque", value: 0, delta_pct: null, sparkline: null },
    banca_active: { label: "Bancas", value: 0, delta_pct: null, sparkline: null },
  },
  pipeline: {
    total_pending_orders: 0,
    in_cutting: 0,
    in_sewing: 0,
    in_stock: 0,
    shipped_30d: 0,
  },
  needs_action: [],
  activity: [],
  revenue_by_channel: [],
};

async function mockApis(page: Page) {
  await page.route(`**/v1/auth/me`, (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ME) }),
  );
  await page.route(`**/v1/auth/session`, (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_ME) }),
  );
  await page.route(`**/v1/dashboard/summary`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DASHBOARD),
    }),
  );
}

test("home page loads and renders in the default locale", async ({ page }) => {
  await mockApis(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("home page loads in English", async ({ page }) => {
  await mockApis(page);
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("home page loads in Portuguese", async ({ page }) => {
  await mockApis(page);
  await page.goto("/pt-BR");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("greeting shows user's first name, not their email", async ({ page }) => {
  await mockApis(page);
  await page.goto("/pt-BR");
  // The heading contains the greeting text + the name as <em>
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toContainText("QA");
  await expect(heading).not.toContainText("qa-dev@orion.local");
});
