import { BYPASS_UID, test, expect, type Page } from "./_support";

/**
 * E2E coverage for FEATURE-010 — Inventory: Stock.
 *
 * Assumes the dev-bypass auth path is enabled and the backend is running. The
 * reset script seeds a single company with the dev-bypass UID `qa-dev-user`
 * as a manager. We create our own product/variation fixtures via the API and
 * then exercise the stock UI.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function api(page: Page, method: string, path: string, body?: unknown) {
  const response = await page.request.fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Bypass-Uid": BYPASS_UID,
      "X-Dev-Bypass-Name": "QA Dev User",
      "X-Dev-Bypass-Email": "qa-dev@orion.local",
    },
    data: body,
  });
  return response;
}

async function seedVariationAndEntry(page: Page, sku: string, quantity: number) {
  // Spec → product → variation. We pick a fresh spec code per call so the
  // unique constraint on (company, spec, print) never collides.
  const specCode = `SPEC${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const specRes = await api(page, "POST", "/v1/specs", {
    code: specCode,
    name: "Stock Test Spec",
    fabric_type: "jersey",
    fabric_grammage_gsm: 180,
    fabric_weight_per_piece_g: "250.00",
    has_ribana: false,
    labor_cost: "12.00",
    sale_price: "99.00",
  });
  expect(specRes.status()).toBe(201);
  const spec = await specRes.json();

  const productRes = await api(page, "POST", "/v1/products", {
    name: `Stock Test ${specCode}`,
    product_type: "camiseta",
    spec_id: spec.id,
    variations: [{ size: "m", color: "Preto", color_code: "PRT" }],
  });
  expect(productRes.status()).toBe(201);
  const product = await productRes.json();
  const variation = product.variations[0];

  const entryRes = await api(page, "POST", "/v1/stock/entries", {
    variation_id: variation.id,
    quantity,
    source: "adjustment",
  });
  expect(entryRes.status()).toBe(201);
  return { spec, product, variation };
}

async function gotoStock(page: Page) {
  await page.goto("/pt-BR/stock");
  await expect(page.getByRole("heading", { name: /Estoque/, level: 1 })).toBeVisible();
}

test.describe("Inventory: Stock", () => {
  test("levels list renders seeded variations", async ({ page }) => {
    const { variation } = await seedVariationAndEntry(page, "SEED-LIST", 20);
    await gotoStock(page);
    await expect(page.getByText(variation.sku)).toBeVisible();
  });

  test("low-stock toggle filters the list", async ({ page }) => {
    const { variation: low } = await seedVariationAndEntry(page, "SEED-LOW", 2);
    const { variation: high } = await seedVariationAndEntry(page, "SEED-HIGH", 100);

    await gotoStock(page);
    await expect(page.getByText(low.sku)).toBeVisible();
    await expect(page.getByText(high.sku)).toBeVisible();

    await page.getByTestId("low-stock-toggle").click();
    await expect(page.getByText(low.sku)).toBeVisible();
    await expect(page.getByText(high.sku)).not.toBeVisible();
  });

  test("clicking a row opens the movements drawer", async ({ page }) => {
    const { variation } = await seedVariationAndEntry(page, "SEED-DRAWER", 15);
    await gotoStock(page);
    await page.getByText(variation.sku).click();
    await expect(page.getByTestId("movements-drawer")).toBeVisible();
    await expect(page.getByTestId("movements-drawer-hero")).toContainText(variation.sku);
  });

  test("manual entry adjustment is reflected in the table", async ({ page }) => {
    const { variation } = await seedVariationAndEntry(page, "SEED-ADD", 10);
    await gotoStock(page);
    await expect(page.getByText(variation.sku)).toBeVisible();

    // Open the row drawer, click "Lançar movimentação" inside it.
    await page.getByText(variation.sku).click();
    await page.getByTestId("drawer-adjust-button").click();
    await expect(page.getByTestId("stock-adjust-dialog")).toBeVisible();

    // The dialog folds direction + reason into a single move-type tile grid.
    // "entrada-ajuste" is the entry-direction "Ajuste (+)" tile → POST /stock/entries.
    await page.getByTestId("stock-adjust-movetype-entrada-ajuste").click();
    const qtyInput = page.getByTestId("stock-adjust-quantity");
    await qtyInput.fill("5");
    await page.getByTestId("stock-adjust-submit").click();

    // Dialog closes, on-hand updates from 10 to 15.
    await expect(page.getByTestId(`stock-on-hand-${variation.sku}`)).toHaveText("15");
  });

  test("exit larger than on-hand surfaces a 409 inline", async ({ page }) => {
    const { variation } = await seedVariationAndEntry(page, "SEED-DENY", 3);
    await gotoStock(page);

    await page.getByText(variation.sku).click();
    await page.getByTestId("drawer-adjust-button").click();
    await expect(page.getByTestId("stock-adjust-dialog")).toBeVisible();

    // "saida-pedido" is the exit-direction "Pedido" tile → POST /stock/exits.
    await page.getByTestId("stock-adjust-movetype-saida-pedido").click();
    const qtyInput = page.getByTestId("stock-adjust-quantity");
    await qtyInput.fill("99");
    await page.getByTestId("stock-adjust-submit").click();

    await expect(page.getByTestId("stock-adjust-server-error")).toContainText(/3/);
  });

  test("/stock/movements renders the full ledger", async ({ page }) => {
    const { variation } = await seedVariationAndEntry(page, "SEED-LEDGER", 4);
    await page.goto("/pt-BR/stock/movements");
    await expect(page.getByRole("heading", { name: /Movimentações/, level: 1 })).toBeVisible();
    await expect(page.getByText(variation.sku)).toBeVisible();
  });
});
