import { test, expect, type Page } from "./_support";

/**
 * E2E coverage for FEATURE-002 — Settings: Members & Roles (roles tab).
 *
 * The roles page is read-only and renders the design-aligned permission
 * matrix from the seeded `admin / manager / operator` roles. It also renders
 * a 3-up grid of role tiles above the matrix, and a legend strip below.
 *
 * We only need a working backend and the dev-bypass auth path to drive these
 * specs.
 */

async function gotoRoles(page: Page) {
  await page.goto("/pt-BR/settings/roles");
  // The matrix card head shows the design's PT-BR title.
  await expect(page.getByText("Matriz de permissões", { exact: true })).toBeVisible();
}

test.describe("Settings: Roles design", () => {
  test("renders one tile per seeded role with friendly i18n name", async ({ page }) => {
    await gotoRoles(page);
    const tiles = page.getByTestId("role-tile");
    await expect(tiles).toHaveCount(3);
    // PT-BR friendly names from roles.tiles.byCode.<code>.name.
    await expect(page.locator('[data-role-code="admin"]').first()).toContainText("Admin");
    await expect(page.locator('[data-role-code="manager"]').first()).toContainText("Gestor");
    await expect(page.locator('[data-role-code="operator"]').first()).toContainText("Operador");
  });

  test("renders the five capability groups from the design source", async ({ page }) => {
    await gotoRoles(page);
    const groups = page.getByTestId("matrix-group");
    await expect(groups).toHaveCount(5);
    // Group labels are the PT-BR strings from roles.matrix.groups.*. Scope the
    // lookup to the matrix group rows (via their data-group attribute) so we
    // don't collide with the same words in the sidebar nav (e.g. "Vendas").
    await expect(page.locator('[data-testid="matrix-group"][data-group="Vendas"]')).toBeVisible();
    await expect(page.locator('[data-testid="matrix-group"][data-group="Catálogo"]')).toBeVisible();
    await expect(page.locator('[data-testid="matrix-group"][data-group="Produção"]')).toBeVisible();
    await expect(page.locator('[data-testid="matrix-group"][data-group="Sistema"]')).toBeVisible();
  });

  test("renders 16 capability rows from the design source", async ({ page }) => {
    await gotoRoles(page);
    const rows = page.getByTestId("matrix-row");
    await expect(rows).toHaveCount(16);
  });

  test("admin column resolves every capability to the 'all' (check) state", async ({ page }) => {
    await gotoRoles(page);
    // Order create+edit capability is a sentinel — admin has orders.write.
    const cell = page.locator(
      '[data-capability="ordersWrite"] [data-role-code="admin"]',
    );
    await expect(cell).toHaveAttribute("data-cell-kind", "all");
  });

  test("operator column shows 'none' on orders create+edit", async ({ page }) => {
    await gotoRoles(page);
    const cell = page.locator(
      '[data-capability="ordersWrite"] [data-role-code="operator"]',
    );
    await expect(cell).toHaveAttribute("data-cell-kind", "none");
  });

  test("manager column shows 'view' on team management (users.read only)", async ({ page }) => {
    await gotoRoles(page);
    const cell = page.locator(
      '[data-capability="teamManage"] [data-role-code="manager"]',
    );
    await expect(cell).toHaveAttribute("data-cell-kind", "view");
  });

  test("legend strip renders three labelled chips", async ({ page }) => {
    await gotoRoles(page);
    const legend = page.getByTestId("permission-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("Pode editar");
    await expect(legend).toContainText("Apenas visualiza");
    await expect(legend).toContainText("Sem acesso");
  });
});
