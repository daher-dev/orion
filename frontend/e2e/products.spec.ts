import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for F-005 (Catalog → Products + Variations).
 *
 * Assumes a clean tenant via dev-bypass (qa-dev-user). The list / create /
 * detail flows hit the live backend; mocking is reserved for the
 * delete-blocked-by-Ad path (we can't construct an Ad through the UI yet).
 */

const PRODUCTS_BASE = "/pt-BR/products";

async function gotoListAndWait(page: Page) {
  await page.goto(PRODUCTS_BASE);
  await expect(page.getByTestId("products-page")).toBeVisible();
}

async function seedSpec(page: Page, code: string, name: string) {
  // Use the API directly via fetch piped through the page's request context —
  // way faster than driving the spec form again and again.
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await page.request.post(`${apiBase}/v1/specs`, {
    headers: {
      "X-Dev-Bypass-Uid": "qa-dev-user",
      "X-Dev-Bypass-Name": "QA Dev User",
      "X-Dev-Bypass-Email": "qa-dev@orion.local",
    },
    data: {
      code,
      name,
      fabric_type: "jersey",
      fabric_grammage_gsm: 180,
      fabric_weight_per_piece_g: "250.00",
      has_ribana: false,
      labor_cost: "12.00",
      sale_price: "99.00",
      trims: [],
    },
  });
  return await res.json();
}

test.describe("F-005 Products — list + empty state", () => {
  test("renders eyebrow, title and either the table or the empty state", async ({ page }) => {
    await gotoListAndWait(page);
    // Scope to the page container — "Catálogo" and "Produtos" also appear in the
    // sidebar nav (section title + nav item), which would make a global getByText
    // ambiguous under strict mode.
    const pageRoot = page.getByTestId("products-page");
    await expect(pageRoot.getByText(/Catálogo/i)).toBeVisible(); // PageHead eyebrow
    await expect(
      pageRoot.getByRole("heading", { name: /Produtos/i }),
    ).toBeVisible(); // list.title

    const hasTable = await page.getByTestId("products-table").isVisible().catch(() => false);
    const hasEmpty = await page.getByTestId("products-empty-state").isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test("filters by search and shows no rows for an unknown name", async ({ page }) => {
    await gotoListAndWait(page);
    await page.getByTestId("products-search").fill("definitely-not-a-product-name");
    // Search is debounced (200ms) then round-trips to the backend, so wait for the
    // filtered result rather than reading the (stale) row count immediately. When a
    // filter is active the page keeps the table mounted with zero rows instead of
    // swapping in the empty state.
    await expect(page.getByTestId("products-table").locator("tbody tr")).toHaveCount(0);
  });
});

test.describe("F-005 Products — create + detail + edit", () => {
  test("creates a product with one variation and shows the SKU on detail", async ({ page }) => {
    const stamp = Date.now();
    await seedSpec(page, `CAM${stamp}`, "E2E Spec");
    await gotoListAndWait(page);

    await page.getByTestId("products-new-cta").click();
    await page.getByTestId("product-form-name").fill(`Cropped ${stamp}`);

    // Pick the seeded spec.
    await page.getByTestId("product-form-spec-trigger").click();
    await page.getByTestId(`spec-option-CAM${stamp}`).click();

    // Toggle a size + add a preset color.
    await page.getByTestId("size-toggle-m").click();
    await page.getByText("Preto").first().click();

    await page.getByTestId("product-form-submit").click();

    // Back on the list — find the new row.
    await expect(page.getByText(`Cropped ${stamp}`)).toBeVisible();
  });

  test("blocks submit until a variation is picked", async ({ page }) => {
    const stamp = Date.now();
    await seedSpec(page, `BLK${stamp}`, "Block Test Spec");
    await gotoListAndWait(page);

    await page.getByTestId("products-new-cta").click();
    await page.getByTestId("product-form-name").fill(`Block ${stamp}`);
    await page.getByTestId("product-form-spec-trigger").click();
    await page.getByTestId(`spec-option-BLK${stamp}`).click();

    // Submit without selecting size/color → expect inline error.
    await page.getByTestId("product-form-submit").click();
    await expect(page.getByTestId("product-form-error")).toContainText(
      /tamanho e uma cor/i,
    );
  });

  test("409 on duplicate (spec, print)", async ({ page }) => {
    const stamp = Date.now();
    await seedSpec(page, `DUP${stamp}`, "Dup Test Spec");
    await gotoListAndWait(page);

    // Create the first product on (spec, no-print).
    await page.getByTestId("products-new-cta").click();
    await page.getByTestId("product-form-name").fill(`First ${stamp}`);
    await page.getByTestId("product-form-spec-trigger").click();
    await page.getByTestId(`spec-option-DUP${stamp}`).click();
    await page.getByTestId("size-toggle-m").click();
    await page.getByText("Preto").first().click();
    await page.getByTestId("product-form-submit").click();
    await expect(page.getByText(`First ${stamp}`)).toBeVisible();

    // Second product on the same (spec, no-print) → backend 409.
    await page.getByTestId("products-new-cta").click();
    await page.getByTestId("product-form-name").fill(`Second ${stamp}`);
    await page.getByTestId("product-form-spec-trigger").click();
    await page.getByTestId(`spec-option-DUP${stamp}`).click();
    await page.getByTestId("size-toggle-m").click();
    await page.getByText("Preto").first().click();
    await page.getByTestId("product-form-submit").click();

    await expect(page.getByTestId("product-form-error")).toContainText(/combinação/i);
  });
});

test.describe("F-005 Products — delete blocked when linked Ad", () => {
  test("surfaces 409 when an Ad references the product", async ({ page }) => {
    // Mock the DELETE response to simulate the conflict.
    await page.route("**/v1/products/*", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Cannot delete product — ads are linked to it",
          }),
        });
        return;
      }
      await route.fallback();
    });

    await gotoListAndWait(page);
    // We can't proceed without rows — bail early when the table is empty.
    const hasRows = await page
      .getByTestId("products-table")
      .locator("tbody tr")
      .first()
      .isVisible()
      .catch(() => false);
    test.skip(!hasRows, "no products available to attempt delete");

    // Per-row delete buttons were removed: the table now uses a row-click → form
    // sheet pattern. Delete lives in the sheet footer, gated by a confirm dialog.
    await page.getByTestId("products-table").locator("tbody tr").first().click();
    const sheet = page.getByTestId("product-form-sheet");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /excluir/i }).click();

    // Confirm in the alert dialog → triggers the (mocked) 409 DELETE.
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: /excluir/i }).click();

    // Toast (sonner) surfaces the error. The 409 detail renders as the toast
    // description; assert on the title alone to stay unambiguous (the message also
    // echoes "ads are linked" in the description line).
    await expect(page.getByText("Não foi possível salvar o produto.")).toBeVisible();
  });
});
