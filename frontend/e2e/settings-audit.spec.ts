import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for FEATURE-018 — Settings: Audit log viewer.
 *
 * The test seeds entries by exercising the public clients API (every
 * create/update/delete writes to `audit_logs`). It then asserts that the
 * page renders rows, the search filter narrows them, the resource-type
 * filter narrows them, and pagination works.
 *
 * These specs assume the dev-bypass auth path is enabled and the backend
 * is running. The bootstrap script seeds a single company with the
 * dev-bypass UID `qa-dev-user` as a manager.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const AUTH_HEADERS = {
  "X-Dev-Bypass-Uid": "qa-dev-user",
  "X-Dev-Bypass-Name": "QA Dev User",
  "X-Dev-Bypass-Email": "qa-dev@orion.local",
} as const;

async function gotoAudit(page: Page) {
  await page.goto("/pt-BR/settings/audit");
  await expect(page.getByText("Log de auditoria")).toBeVisible();
}

async function apiCreateClient(page: Page, name: string) {
  const response = await page.request.post(`${API_URL}/v1/clients`, {
    headers: AUTH_HEADERS,
    data: { name },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function apiCreatePrint(page: Page, code: string) {
  const response = await page.request.post(`${API_URL}/v1/prints`, {
    headers: AUTH_HEADERS,
    data: { code, name: `Print ${code}`, cost_per_unit: 1.5 },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function apiDeleteAllClients(page: Page) {
  const list = await page.request.get(`${API_URL}/v1/clients?page_size=100`, {
    headers: AUTH_HEADERS,
  });
  if (!list.ok()) return;
  const body = await list.json();
  for (const item of body.items ?? []) {
    await page.request.delete(`${API_URL}/v1/clients/${item.id}`, {
      headers: AUTH_HEADERS,
    });
  }
}

async function apiDeleteAllPrints(page: Page) {
  const list = await page.request.get(`${API_URL}/v1/prints?page_size=100`, {
    headers: AUTH_HEADERS,
  });
  if (!list.ok()) return;
  const body = await list.json();
  for (const item of body.items ?? []) {
    await page.request.delete(`${API_URL}/v1/prints/${item.id}`, {
      headers: AUTH_HEADERS,
    });
  }
}

test.describe("Settings: Audit log", () => {
  test.beforeEach(async ({ page }) => {
    await apiDeleteAllClients(page);
    await apiDeleteAllPrints(page);
  });

  test("renders seeded audit entries from client creations", async ({ page }) => {
    await apiCreateClient(page, "Mariana Costa");
    await apiCreateClient(page, "Felipe Andrade");

    await gotoAudit(page);

    // Both creation messages should appear in the table.
    await expect(page.getByText("Created client Mariana Costa")).toBeVisible();
    await expect(page.getByText("Created client Felipe Andrade")).toBeVisible();
  });

  test("search filter narrows the visible entries", async ({ page }) => {
    await apiCreateClient(page, "Mariana Costa");
    await apiCreateClient(page, "Felipe Andrade");

    await gotoAudit(page);

    await page.getByPlaceholder("Buscar mensagem ou recurso…").fill("Mariana");

    await expect(page.getByText("Created client Mariana Costa")).toBeVisible();
    await expect(page.getByText("Created client Felipe Andrade")).not.toBeVisible();
  });

  test("resource type filter narrows the list", async ({ page }) => {
    await apiCreateClient(page, "Beatriz Rocha");
    await apiCreatePrint(page, "AUDIT-PRINT-1");

    await gotoAudit(page);

    // Both should be visible initially.
    await expect(page.getByText("Created client Beatriz Rocha")).toBeVisible();
    await expect(page.getByText(/Created print/)).toBeVisible();

    // Open the resource-type filter dropdown.
    await page.getByRole("combobox", { name: "Tipo de recurso" }).click();
    await page.getByRole("option", { name: "Clientes" }).click();

    await expect(page.getByText("Created client Beatriz Rocha")).toBeVisible();
    await expect(page.getByText(/Created print/)).not.toBeVisible();
  });

  test("pagination shows the page-of-total indicator", async ({ page }) => {
    // 25 entries == one full page (PAGE_SIZE in the component).
    // Create 30 so that pagination is necessary.
    for (let i = 0; i < 30; i++) {
      await apiCreateClient(page, `Audit Client ${i}`);
    }

    await gotoAudit(page);

    // Default page 1 of 2 (30 items / 25 per page = 2 pages total).
    await expect(page.getByTestId("audit-pagination-status")).toContainText(
      "Página 1 de 2",
    );

    await page.getByRole("button", { name: /Próximo/ }).click();
    await expect(page.getByTestId("audit-pagination-status")).toContainText(
      "Página 2 de 2",
    );
  });
});
