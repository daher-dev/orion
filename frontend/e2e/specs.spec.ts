import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for F-003 (Catalog → Specs).
 *
 * Backend assumption: a clean test DB seeded with the 3 default roles + a
 * single tenant via dev-bypass. Each test cleans its own state via the
 * delete endpoint; collisions between tests would surface as 409 conflicts.
 *
 * The dev-bypass UID `qa-dev-user` is the same one the backend conftest uses
 * — `scripts/reset-test-db.sh` followed by an onboarding POST sets up the
 * first tenant under that identity.
 */

const SPECS_BASE = "/pt-BR/specs";

async function gotoListAndWait(page: Page) {
  await page.goto(SPECS_BASE);
  await expect(page.getByTestId("specs-list-page")).toBeVisible();
}

// The numeric fields render the `NumberInput` primitive, which is controlled
// *on blur* — it keeps a local draft while focused and only commits the parsed
// value to form state when it loses focus. Playwright's `fill` doesn't blur, so
// we blur explicitly or the value never reaches the payload and submit no-ops.
async function fillNumber(page: Page, testId: string, value: string) {
  const field = page.getByTestId(testId);
  await field.fill(value);
  await field.blur();
}

async function newSpec(page: Page, code: string, name: string, opts: { withRibana?: boolean; trims?: number } = {}) {
  await page.getByTestId("specs-new-cta").click();
  await expect(page).toHaveURL(/\/specs\/new$/);
  await page.getByTestId("spec-form-code").fill(code);
  await page.getByTestId("spec-form-name").fill(name);
  await fillNumber(page, "spec-form-gsm", "180");
  await fillNumber(page, "spec-form-weight", "250");
  await fillNumber(page, "spec-form-labor", "12");
  await fillNumber(page, "spec-form-sale", "99");

  if (opts.withRibana) {
    await page.getByTestId("spec-form-has-ribana").click();
    // ribana_weight_pct is a native range slider — `fill` sets it directly.
    await page.getByTestId("spec-form-ribana-pct").fill("10");
  }

  for (let i = 0; i < (opts.trims ?? 0); i += 1) {
    await page.getByTestId("spec-form-add-trim").click();
  }

  await page.getByTestId("spec-form-submit").click();
}

test.describe("F-003 Specs — list + filters + empty state", () => {
  test("renders the page-head, search, fabric filter, and either a table or the empty state", async ({ page }) => {
    await gotoListAndWait(page);

    // The page header is the shared <PageHead> component, which emits no
    // testids — assert the rendered eyebrow text + the <h1> title instead.
    // "Catálogo" also appears in the sidebar nav, so scope the eyebrow lookup
    // to the page container to avoid a strict-mode collision.
    await expect(page.getByTestId("specs-list-page").getByText("Catálogo")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Fichas técnicas/i);

    await expect(page.getByTestId("specs-search")).toBeVisible();
    await expect(page.getByTestId("specs-fabric-filter")).toBeVisible();

    // Web-first wait for the list query to settle into EITHER the table or the
    // empty state. A point-in-time isVisible() snapshot raced the data fetch on a
    // cold CI load — both were still the loading skeleton → flaky failure.
    await expect(
      page.getByTestId("specs-table").or(page.getByTestId("specs-empty-state")),
    ).toBeVisible();
  });

  test("search field debounces and updates the row count", async ({ page }) => {
    await gotoListAndWait(page);
    await page.getByTestId("specs-search").fill("nonexistentcode");
    await expect(page.getByTestId("specs-table-empty").or(page.getByTestId("specs-empty-state"))).toBeVisible();
  });
});

test.describe("F-003 Specs — create happy path", () => {
  test("creates a spec without ribana and without trims", async ({ page }) => {
    const code = `E2E-${Date.now()}`;
    await gotoListAndWait(page);
    await newSpec(page, code, "E2E Plain Tee");
    await expect(page).toHaveURL(/\/specs\/[0-9a-f-]+$/);
    // The detail page renders the spec name as its <h1> (via <PageHead title>).
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E Plain Tee");
    await page.getByRole("link", { name: /voltar/i }).click();
    await expect(page.getByText(code)).toBeVisible();
  });

  test("creates a spec with ribana on + 2 trims", async ({ page }) => {
    const code = `E2E-RIB-${Date.now()}`;
    await gotoListAndWait(page);
    await newSpec(page, code, "E2E Cropped", { withRibana: true, trims: 2 });
    await expect(page).toHaveURL(/\/specs\/[0-9a-f-]+$/);
    await expect(page.getByText(/Ribana/i)).toBeVisible();
  });

  test("validation: ribana on without pct surfaces inline error", async ({ page }) => {
    await gotoListAndWait(page);
    await page.getByTestId("specs-new-cta").click();
    await page.getByTestId("spec-form-code").fill(`E2E-VAL-${Date.now()}`);
    await page.getByTestId("spec-form-name").fill("Bad ribana");
    await fillNumber(page, "spec-form-gsm", "180");
    await fillNumber(page, "spec-form-weight", "250");
    await fillNumber(page, "spec-form-labor", "12");
    await page.getByTestId("spec-form-has-ribana").click();
    // ribana pct intentionally left untouched — has_ribana is on but the
    // percentage stays empty, which is exactly what the validator rejects.
    // (The control is a range slider; calling fill("") on it is malformed.)
    await page.getByTestId("spec-form-submit").click();
    await expect(page.getByTestId("spec-form-error")).toBeVisible();
  });

  test("validation: duplicate code surfaces a 409 message", async ({ page }) => {
    const code = `E2E-DUP-${Date.now()}`;
    await gotoListAndWait(page);
    await newSpec(page, code, "First");
    await page.goto(SPECS_BASE);
    await newSpec(page, code, "Second");
    await expect(page.getByTestId("spec-form-error")).toBeVisible();
  });
});

test.describe("F-003 Specs — edit happy path", () => {
  test("opens detail, switches to edit, changes name + replaces trim list", async ({ page }) => {
    const code = `E2E-EDT-${Date.now()}`;
    await gotoListAndWait(page);
    await newSpec(page, code, "Old Name", { trims: 1 });

    await expect(page).toHaveURL(/\/specs\/[0-9a-f-]+$/);
    await page.getByTestId("spec-detail-edit").click();

    await page.getByTestId("spec-form-name").fill("Renamed");
    // Replace trims: remove the one we have, add 3 fresh ones.
    while (await page.getByTestId(/trim-row-\d+-remove/).first().isVisible().catch(() => false)) {
      await page.getByTestId(/trim-row-\d+-remove/).first().click();
    }
    await page.getByTestId("spec-form-add-trim").click();
    await page.getByTestId("spec-form-add-trim").click();
    await page.getByTestId("spec-form-add-trim").click();

    await page.getByTestId("spec-form-submit").click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Renamed");
  });
});

test.describe("F-003 Specs — delete with confirm", () => {
  test("delete shows confirm + removes spec", async ({ page }) => {
    const code = `E2E-DEL-${Date.now()}`;
    await gotoListAndWait(page);
    await newSpec(page, code, "To delete");

    await page.getByTestId("spec-detail-delete").click();
    await page.getByTestId("spec-detail-confirm-delete").click();

    await expect(page).toHaveURL(/\/specs$/);
    await expect(page.getByText(code)).toHaveCount(0);
  });
});

test.describe("F-003 Specs — operator (read-only) UI guard", () => {
  // The backend gate is the source of truth — operators have specs.read but
  // not specs.write. The test verifies that the write CTA is hidden for them.
  test.skip(
    !process.env.PLAYWRIGHT_OPERATOR_UID,
    "Set PLAYWRIGHT_OPERATOR_UID in env to a seeded operator user",
  );
  test("operator does not see Nova ficha CTA", async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      "X-Dev-Bypass-Uid": process.env.PLAYWRIGHT_OPERATOR_UID ?? "",
    });
    await page.goto(SPECS_BASE);
    await expect(page.getByTestId("specs-new-cta")).toHaveCount(0);
  });
});
