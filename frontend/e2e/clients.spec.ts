import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for FEATURE-011 — Sales: Clients.
 *
 * These specs assume the dev-bypass auth path is enabled and the backend
 * is running. The test reset script (`scripts/reset-test-db.sh`) seeds a
 * single company with the dev-bypass UID `qa-dev-user` as a manager.
 *
 * Each test starts from a clean slate where possible — we lean on the
 * empty state for the empty-list assertions and create our own fixtures
 * via the API for the rest.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function gotoClients(page: Page) {
  await page.goto("/pt-BR/clients");
  await expect(page.getByRole("heading", { name: "Clientes", level: 1 })).toBeVisible();
}

async function apiCreate(page: Page, payload: Record<string, unknown>) {
  // Mirror the X-Dev-Bypass headers the frontend sends so the backend
  // resolves the same User row.
  const response = await page.request.post(`${API_URL}/v1/clients`, {
    headers: {
      "X-Dev-Bypass-Uid": "qa-dev-user",
      "X-Dev-Bypass-Name": "QA Dev User",
      "X-Dev-Bypass-Email": "qa-dev@orion.local",
    },
    data: payload,
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function apiDeleteAll(page: Page) {
  const list = await page.request.get(`${API_URL}/v1/clients?page_size=100`, {
    headers: {
      "X-Dev-Bypass-Uid": "qa-dev-user",
    },
  });
  if (!list.ok()) return;
  const body = await list.json();
  for (const item of body.items ?? []) {
    await page.request.delete(`${API_URL}/v1/clients/${item.id}`, {
      headers: { "X-Dev-Bypass-Uid": "qa-dev-user" },
    });
  }
}

test.describe("Sales: Clients", () => {
  test.beforeEach(async ({ page }) => {
    await apiDeleteAll(page);
  });

  test("empty state CTA is reachable when no clients exist", async ({ page }) => {
    await gotoClients(page);
    await expect(page.getByText("Nenhum cliente ainda")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Novo cliente/i }).first(),
    ).toBeVisible();
  });

  test("loads list with seeded clients", async ({ page }) => {
    await apiCreate(page, {
      name: "Mariana Costa",
      email: "mariana@example.com",
      phone: "+55 11 99999-0000",
    });
    await apiCreate(page, {
      name: "Felipe Andrade",
      email: "felipe@example.com",
    });
    await gotoClients(page);
    await expect(page.getByText("Mariana Costa")).toBeVisible();
    await expect(page.getByText("Felipe Andrade")).toBeVisible();
  });

  test("create happy path adds a client to the list", async ({ page }) => {
    await gotoClients(page);
    await page
      .getByRole("button", { name: /Novo cliente/i })
      .first()
      .click();
    await page.getByLabel("Nome").fill("Beatriz Rocha");
    await page.getByLabel("E-mail").fill("beatriz@example.com");
    await page.getByLabel("Telefone").fill("(11) 99999-1234");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente criado")).toBeVisible();
    await expect(page.getByText("Beatriz Rocha")).toBeVisible();
  });

  test("validation errors block submission of an empty form", async ({ page }) => {
    await gotoClients(page);
    await page
      .getByRole("button", { name: /Novo cliente/i })
      .first()
      .click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Nome é obrigatório")).toBeVisible();
  });

  test("edit happy path updates the row", async ({ page }) => {
    await apiCreate(page, { name: "Lucas Pereira", email: "l@example.com" });
    await gotoClients(page);
    // Row click opens the edit sheet (per-row edit/delete buttons were
    // consolidated into the sheet that opens on row click).
    await page.getByText("Lucas Pereira").click();
    const nameInput = page.getByLabel("Nome");
    await nameInput.fill("Lucas Pereira Silva");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Cliente atualizado")).toBeVisible();
    await expect(page.getByText("Lucas Pereira Silva")).toBeVisible();
  });

  test("delete with confirm removes the row", async ({ page }) => {
    await apiCreate(page, { name: "Aline Souza" });
    await gotoClients(page);
    // Open the sheet via row click, hit the footer delete, then confirm in the
    // alert dialog (scope to the dialog so we don't match the footer button).
    await page.getByText("Aline Souza").click();
    await page.getByRole("button", { name: "Excluir" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Excluir" })
      .click();
    await expect(page.getByText("Cliente excluído")).toBeVisible();
    await expect(page.getByText("Aline Souza")).not.toBeVisible();
  });

  test("search filters the list", async ({ page }) => {
    await apiCreate(page, { name: "Mariana Costa", email: "m@example.com" });
    await apiCreate(page, { name: "Felipe Andrade", email: "f@example.com" });
    await gotoClients(page);
    await page.getByPlaceholder("Procurar cliente…").fill("mari");
    await expect(page.getByText("Mariana Costa")).toBeVisible();
    await expect(page.getByText("Felipe Andrade")).not.toBeVisible();
  });
});

test.describe("Sales: Clients — operator (no clients.write)", () => {
  // To run this block, set NEXT_PUBLIC_DEV_BYPASS_UID to a UID provisioned
  // as an operator role. Skipped when the env doesn't reflect that.
  test.skip(
    process.env.NEXT_PUBLIC_DEV_BYPASS_UID !== "qa-operator-user",
    "Requires NEXT_PUBLIC_DEV_BYPASS_UID=qa-operator-user (operator role)",
  );

  test("sidebar hides Clients and direct API returns 403", async ({ page }) => {
    await page.goto("/pt-BR");
    // Sidebar entry should be hidden for operator-only users.
    await expect(page.getByRole("link", { name: "Clientes" })).toHaveCount(0);

    const direct = await page.request.get(`${API_URL}/v1/clients`, {
      headers: { "X-Dev-Bypass-Uid": "qa-operator-user" },
    });
    expect(direct.status()).toBe(403);
  });
});
