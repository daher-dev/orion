import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for FEATURE-002 — Settings: Members & Roles (roles tab).
 *
 * The roles page is read-only and renders the permission matrix from the
 * seeded `admin / manager / operator` roles. We only need a working backend
 * and the dev-bypass auth path to drive these specs.
 */

async function gotoRoles(page: Page) {
  await page.goto("/pt-BR/settings/roles");
  await expect(page.getByText("Funções e permissões", { exact: true })).toBeVisible();
}

test.describe("Settings: Roles matrix", () => {
  test("renders all three seeded roles as columns", async ({ page }) => {
    await gotoRoles(page);
    await expect(page.getByText("Administrator", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Manager", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Operator", { exact: true }).first()).toBeVisible();
  });

  test("renders one row per permission domain", async ({ page }) => {
    await gotoRoles(page);
    const rows = page.getByTestId("matrix-row");
    await expect(rows).toHaveCount(14);
  });

  test("admin column has read+write checks for users domain", async ({ page }) => {
    await gotoRoles(page);
    const adminUsersCell = page.locator(
      'td[data-role-code="admin"][data-domain="users"]',
    );
    await expect(adminUsersCell.getByTestId("cell-read")).toBeVisible();
    await expect(adminUsersCell.getByTestId("cell-write")).toBeVisible();
  });

  test("operator column has empty cell on orders domain", async ({ page }) => {
    await gotoRoles(page);
    const cell = page.locator('td[data-role-code="operator"][data-domain="orders"]');
    await expect(cell.getByTestId("cell-empty")).toBeVisible();
  });
});
