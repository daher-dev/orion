import { test, expect, type Page, type Route } from "./_support";

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

const MOCK_ME_OPERATOR = {
  ...MOCK_ME,
  role: { id: "44444444-4444-4444-4444-444444444444", code: "operator", name: "Operator" },
  permissions: ["orders.read", "cutting.read", "cutting.write", "stock.read", "stock.write"],
  companies: [{ id: "22222222-2222-2222-2222-222222222222", name: "QA Co", role_code: "operator" }],
};

// Mirrors backend/src/schemas/dashboard.py DashboardSummary.
const MOCK_DASHBOARD = {
  conference: {
    totals: {
      orders: 12,
      pieces: 30,
      mapped: 25,
      pending: 5,
      mapped_pct: 83,
      in_lote: 4,
      orders_checked: 6,
      orders_partial: 2,
      orders_untouched: 4,
      pieces_checked: 18,
    },
  },
  top_products: [{ name: "2055", image_url: null, pieces: 18, orders: 12 }],
  needs_action: [],
  activity: [],
  operator: {
    cuts_in_queue: 3,
    shipments_incoming: 2,
    pieces_today: 12,
    cutting_queue: [{ id: "c1", code: "CAM01", color: "Preto", status: "pending" }],
  },
};

async function mockApis(page: Page, me: object = MOCK_ME) {
  await page.route(`**/v1/auth/me`, (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(me) }),
  );
  await page.route(`**/v1/auth/session`, (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(me) }),
  );
  await page.route(`**/v1/dashboard/summary`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DASHBOARD),
    }),
  );
}

test("home page loads and renders the manager conference layout", async ({ page }) => {
  await mockApis(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // New conference-centred layout: KPI strip + top products, no operator view.
  await expect(page.getByTestId("conference-kpis")).toBeVisible();
  await expect(page.getByTestId("top-products")).toBeVisible();
  await expect(page.getByTestId("operator-kpis")).toHaveCount(0);
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

test("operator role sees the factory-floor dashboard, not the manager view", async ({ page }) => {
  await mockApis(page, MOCK_ME_OPERATOR);
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Operator variant renders its KPIs + cutting queue, and none of the
  // manager-only conference sections.
  await expect(page.getByTestId("operator-kpis")).toBeVisible();
  await expect(page.getByTestId("operator-queue")).toBeVisible();
  await expect(page.getByTestId("conference-kpis")).toHaveCount(0);
  await expect(page.getByTestId("top-products")).toHaveCount(0);
});
