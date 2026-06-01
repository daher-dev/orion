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

    // Both creation messages should appear in the table. Audit rows are
    // append-only and never purged between runs, so the same message can
    // appear more than once — assert at least one match via `.first()`.
    await expect(
      page.getByText("Created client Mariana Costa").first(),
    ).toBeVisible();
    await expect(
      page.getByText("Created client Felipe Andrade").first(),
    ).toBeVisible();
  });

  test("search filter narrows the visible entries", async ({ page }) => {
    await apiCreateClient(page, "Mariana Costa");
    await apiCreateClient(page, "Felipe Andrade");

    await gotoAudit(page);

    await page.getByPlaceholder("Buscar mensagem ou recurso…").fill("Mariana");

    // The matching row(s) stay; non-matching rows are filtered out. Audit
    // entries are append-only, so "Mariana" may match more than one row —
    // assert at least one via `.first()`.
    await expect(
      page.getByText("Created client Mariana Costa").first(),
    ).toBeVisible();
    // The server filters by message, so no Felipe row should survive.
    // Use `toHaveCount(0)` (not `not.toBeVisible`) so it tolerates the
    // append-only history of Felipe rows and waits out the debounced
    // refetch instead of tripping strict mode on multiple stale matches.
    await expect(page.getByText("Created client Felipe Andrade")).toHaveCount(0);
  });

  test("resource type filter narrows the list", async ({ page }) => {
    await apiCreateClient(page, "Beatriz Rocha");
    await apiCreatePrint(page, "AUDIT-PRINT-1");

    await gotoAudit(page);

    // Both should be visible initially. Audit rows are append-only, so a
    // message may match more than one historical row — assert at least one
    // via `.first()`.
    await expect(
      page.getByText("Created client Beatriz Rocha").first(),
    ).toBeVisible();
    await expect(page.getByText(/Created print/).first()).toBeVisible();

    // Open the resource-type filter dropdown.
    await page.getByRole("combobox", { name: "Tipo de recurso" }).click();
    await page.getByRole("option", { name: "Clientes" }).click();

    await expect(
      page.getByText("Created client Beatriz Rocha").first(),
    ).toBeVisible();
    // Filtering to "Clientes" drops every print row. Use `toHaveCount(0)`
    // so append-only print history doesn't trip strict mode and the wait
    // covers the filter refetch.
    await expect(page.getByText(/Created print/)).toHaveCount(0);
  });

  test("pagination shows the page-of-total indicator", async ({ page }) => {
    // 25 entries == one full page (PAGE_SIZE in the component).
    // Create 30 so that more than one page is guaranteed.
    for (let i = 0; i < 30; i++) {
      await apiCreateClient(page, `Audit Client ${i}`);
    }

    await gotoAudit(page);

    // Audit rows are append-only and never purged, so the total page count
    // depends on accumulated history — assert the format and current page
    // rather than a fixed total. The indicator reads "Página {page} de {total}".
    const status = page.getByTestId("audit-pagination-status");
    await expect(status).toHaveText(/^Página 1 de \d+$/);

    await page.getByRole("button", { name: /Próximo/ }).click();
    await expect(status).toHaveText(/^Página 2 de \d+$/);
  });
});
