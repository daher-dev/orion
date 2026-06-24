import { BYPASS_UID, BYPASS_EMAIL, test, expect, type Page } from "./_support";

/**
 * E2E coverage for the Platform Console (super-admin backoffice).
 *
 * The console is gated by User.is_operator. The dev-bypass identity (qa-dev-user)
 * is a plain tenant admin by default, so we flip the flag via the non-prod
 * test-support endpoint at the start of the operator scenarios and reset it after.
 *
 * Locators target DOM text (not the CSS-uppercased rendering) and prefer unique
 * strings so they don't collide with the sidebar nav.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const QA_HEADERS = {
  "X-Dev-Bypass-Uid": BYPASS_UID,
  "X-Dev-Bypass-Name": "QA Dev User",
  "X-Dev-Bypass-Email": "qa-dev@orion.local",
};

async function setOperator(page: Page, value: boolean) {
  await page.request.post(`${API_URL}/v1/test-support/set-operator`, {
    headers: QA_HEADERS,
    data: { value },
  });
}

test.describe("Platform Console — operator", () => {
  test.beforeEach(async ({ page }) => {
    await setOperator(page, true);
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${API_URL}/v1/test-support/set-operator`, {
      headers: QA_HEADERS,
      data: { value: false },
    });
  });

  test("overview renders with platform KPIs", async ({ page }) => {
    await page.goto("/pt-BR/console");
    await expect(page.getByRole("heading", { name: /Saúde da/ })).toBeVisible();
    // KPI foot copy is unique (unlike the labels, which collide with the nav).
    await expect(page.getByText("workspaces de clientes")).toBeVisible();
    await expect(page.getByText("equipe Orion com acesso ao console")).toBeVisible();
    // MRR / charts panels are explicitly deferred.
    await expect(page.getByText("Receita e MRR chegam em breve.")).toBeVisible();
  });

  test("organizations list shows orgs and opens detail", async ({ page }) => {
    await page.goto("/pt-BR/console/organizations");
    await expect(page.getByRole("heading", { name: "Organizações" })).toBeVisible();
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(page.getByText("Uso no plano")).toBeVisible();
    await expect(page.getByRole("button", { name: /Entrar como/ })).toBeVisible();
    await expect(page.getByText("Zona crítica")).toBeVisible();
  });

  test("users page lists the platform operator", async ({ page }) => {
    await page.goto("/pt-BR/console/users");
    await expect(page.getByRole("heading", { name: /Usuários/ })).toBeVisible();
    await expect(page.getByText(BYPASS_EMAIL)).toBeVisible();
  });

  test("plans and integrations render the Em breve catalog", async ({ page }) => {
    await page.goto("/pt-BR/console/plans");
    await expect(page.getByRole("heading", { name: "Planos" })).toBeVisible();
    await expect(page.getByText(/somente leitura/)).toBeVisible();
    await expect(page.getByText("Ateliê", { exact: true })).toBeVisible();

    await page.goto("/pt-BR/console/integrations");
    await expect(page.getByRole("heading", { name: "Integrações" })).toBeVisible();
    await expect(page.getByText("Marketplaces")).toBeVisible();
    await expect(page.getByText("Shopee")).toBeVisible();
  });

  test("impersonating a non-member org shows the support-session banner", async ({ page }) => {
    // Create a fresh org the dev-bypass user is NOT a member of (entering its own
    // company would not impersonate). Owning the data keeps the test independent
    // of the seed, which only guarantees the caller's own company exists.
    const suffix = Date.now();
    const name = `Banca E2E ${suffix}`;
    const created = await page.request.post(`${API_URL}/v1/admin/organizations`, {
      headers: QA_HEADERS,
      data: { name, subdomain: `banca-e2e-${suffix}`, owner_email: `owner-${suffix}@example.com` },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto("/pt-BR/console/organizations");
    const row = page.locator("tr", { hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/pt-BR(\/|$)/);
    await expect(page.getByText(/Sessão de suporte/)).toBeVisible();
    // Ending the session returns to the console.
    await page.getByRole("button", { name: /Encerrar/ }).click();
    await expect(page).toHaveURL(/\/console$/);
  });
});

test.describe("Platform Console — non-operator", () => {
  test("non-operator is redirected away from the console", async ({ page }) => {
    await setOperator(page, false);
    await page.goto("/pt-BR/console");
    await expect(page).toHaveURL(/\/pt-BR\/?$/);
    await expect(page.getByText("Saúde da")).toHaveCount(0);
  });
});
