import { test, expect, type Page } from "@playwright/test";

/**
 * E2E smoke for FEATURE-015 — Reports frontend.
 *
 * Assumes the dev-bypass auth path is enabled and the backend is running.
 * The reports endpoints return well-formed empty payloads for a fresh
 * tenant, so we don't need to seed anything to assert the page renders +
 * the tabs/date picker are wired.
 */

async function gotoReports(page: Page) {
  await page.goto("/pt-BR/reports");
  await expect(page.getByRole("heading", { name: /Relatórios/, level: 1 })).toBeVisible();
}

test.describe("Reports", () => {
  test("page renders all four tabs and the date range picker", async ({ page }) => {
    await gotoReports(page);

    // Eyebrow chip — Reports uses the deep-blue brand colour. The eyebrow text
    // ("Relatórios") also appears in the sidebar nav and the H1, so scope to the
    // eyebrow div whose entire text is exactly "Relatórios".
    await expect(page.locator("div").filter({ hasText: /^Relatórios$/ })).toBeVisible();
    // 4 tabs
    await expect(page.getByRole("tab", { name: /Vendas/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Produção/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Estoque/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Custos/ })).toBeVisible();
    // Date range trigger (defaults to "Últimos 90 dias")
    await expect(page.getByRole("button", { name: /Últimos 90 dias/ })).toBeVisible();
  });

  test("Sales tab loads its KPI titles", async ({ page }) => {
    await gotoReports(page);
    // Sales is the default tab; the two KPI titles should be visible.
    await expect(page.getByText("Receita total")).toBeVisible();
    await expect(page.getByText("Total de pedidos")).toBeVisible();
    // Chart card titles
    await expect(page.getByText("Pedidos por canal")).toBeVisible();
    await expect(page.getByText("Receita por dia")).toBeVisible();
  });

  test("switching tabs loads each report panel", async ({ page }) => {
    await gotoReports(page);

    await page.getByRole("tab", { name: /Produção/ }).click();
    await expect(page.getByText("Throughput de corte")).toBeVisible();
    await expect(page.getByText("Throughput de costura")).toBeVisible();

    await page.getByRole("tab", { name: /Estoque/ }).click();
    await expect(page.getByText("Níveis atuais de estoque")).toBeVisible();
    await expect(page.getByText("Peças paradas")).toBeVisible();

    await page.getByRole("tab", { name: /Custos/ }).click();
    await expect(page.getByText("Custos por ficha")).toBeVisible();
    await expect(page.getByText("Custo médio de tecido por kg")).toBeVisible();
  });

  test("date range picker opens and applies a preset", async ({ page }) => {
    await gotoReports(page);

    await page.getByRole("button", { name: /Últimos 90 dias/ }).click();
    // The popover shows three preset chips. Scope to the chip inside the popover
    // dialog so it doesn't ambiguously match the trigger button label.
    const presetChip = page
      .getByRole("dialog")
      .getByRole("button", { name: "Últimos 7 dias" });
    await expect(presetChip).toBeVisible();
    await presetChip.click();

    // After selecting, the trigger label updates. Scope to the popover trigger
    // so the assertion targets the trigger button, not a lingering preset chip.
    await expect(
      page.locator('[data-slot="popover-trigger"]').filter({ hasText: /Últimos 7 dias/ }),
    ).toBeVisible();
  });
});
