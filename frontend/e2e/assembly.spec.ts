import { BYPASS_UID, test, expect, type Page } from "./_support";

/**
 * E2E coverage for Phase 4 — Montagem (Assembly · T5).
 *
 * Dev-bypass auth + a running backend. We seed a blank piece (spec-keyed) and a
 * printed transfer (design-keyed), each credited to a known on-hand via an ENTRY
 * movement, then drive the UI: the buildable assist lists the pair, and a manual
 * "Montagem avulsa" assembles units → cross-check finished stock credited +
 * blank/printed debited. A beyond-available assemble surfaces a 409 inline.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function api(page: Page, method: string, path: string, body?: unknown) {
  return page.request.fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Bypass-Uid": BYPASS_UID,
      "X-Dev-Bypass-Name": "QA Dev User",
      "X-Dev-Bypass-Email": "qa-dev@orion.local",
    },
    data: body,
  });
}

function rand(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function seedSpec(page: Page) {
  const code = rand("SPEC");
  const res = await api(page, "POST", "/v1/specs", {
    code,
    name: `Camiseta ${code}`,
    fabric_type: "jersey",
    fabric_grammage_gsm: 180,
    fabric_weight_per_piece_g: "250.00",
    has_ribana: false,
    labor_cost: "12.00",
    sale_price: "99.00",
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function seedBlankOnHand(page: Page, specId: string, onHand: number) {
  const createRes = await api(page, "POST", "/v1/blank-stock", {
    spec_id: specId,
    size: "m",
    color: "Preto",
    color_code: "PRT",
  });
  expect(createRes.status()).toBe(201);
  const blank = await createRes.json();
  const mvRes = await api(page, "POST", "/v1/blank-stock/movements", {
    blank_piece_id: blank.blank_piece_id,
    kind: "entry",
    quantity: onHand,
  });
  expect(mvRes.status()).toBe(201);
  return blank;
}

async function seedPrintedOnHand(page: Page, onHand: number) {
  const code = rand("DSN");
  const designRes = await api(page, "POST", "/v1/prints", {
    code,
    name: `Estampa ${code}`,
    technique: "dtf",
    cost_per_unit: "5.00",
    has_front: true,
    has_back: false,
  });
  expect(designRes.status()).toBe(201);
  const design = await designRes.json();

  const transferRes = await api(page, "POST", "/v1/printed-transfers", {
    print_design_id: design.id,
    side: "front",
  });
  expect(transferRes.status()).toBe(201);
  const transfer = await transferRes.json();

  const mvRes = await api(page, "POST", "/v1/printed-transfers/movements", {
    printed_transfer_id: transfer.printed_transfer_id,
    kind: "entry",
    quantity: onHand,
  });
  expect(mvRes.status()).toBe(201);
  return { design, transfer };
}

test.describe("Montagem (Assembly)", () => {
  test("buildable assist lists a blank + printed pair on hand", async ({ page }) => {
    const spec = await seedSpec(page);
    await seedBlankOnHand(page, spec.id, 9);
    const { design } = await seedPrintedOnHand(page, 4);

    await page.goto("/pt-BR/assembly");
    await expect(page.getByRole("heading", { name: /Montagem/, level: 1 })).toBeVisible();
    await expect(page.getByTestId("assembly-buildable-list")).toBeVisible();
    // The resulting SKU is <SPEC>-M-PRT-<DESIGN code>.
    await expect(page.getByText(`${spec.code}-M-PRT-${design.code}`)).toBeVisible();
  });

  test("buildable Montar credits finished stock + debits blank/printed", async ({ page }) => {
    const spec = await seedSpec(page);
    const blank = await seedBlankOnHand(page, spec.id, 9);
    const { design, transfer } = await seedPrintedOnHand(page, 4);
    const sku = `${spec.code}-M-PRT-${design.code}`;

    await page.goto("/pt-BR/assembly");
    const card = page.getByTestId("buildable-card").filter({ hasText: sku });
    await expect(card).toBeVisible();
    // Montar min(9, 4) = 4.
    await card.getByTestId("buildable-build").click();

    // Cross-check finished stock credited for the resolved SKU.
    await expect
      .poll(async () => {
        const stock = await (await api(page, "GET", "/v1/stock/levels?page_size=100")).json();
        const row = stock.items.find((r: { sku: string }) => r.sku === sku);
        return row?.on_hand ?? 0;
      })
      .toBe(4);

    // Blank debited 9 → 5.
    const blanks = await (await api(page, "GET", "/v1/blank-stock/levels?page_size=100")).json();
    const blankRow = blanks.items.find(
      (r: { blank_piece_id: string }) => r.blank_piece_id === blank.blank_piece_id,
    );
    expect(blankRow?.on_hand).toBe(5);

    // Printed debited 4 → 0.
    const printed = await (await api(page, "GET", "/v1/printed-transfers/levels?page_size=100")).json();
    const printedRow = printed.items.find(
      (r: { printed_transfer_id: string }) => r.printed_transfer_id === transfer.printed_transfer_id,
    );
    expect(printedRow?.on_hand).toBe(0);
  });

  test("manual assemble beyond available is clamped to the on-hand max", async ({ page }) => {
    const spec = await seedSpec(page);
    // Blank on-hand 1; printed on-hand 5 → buildable max is min(1,5)=1.
    await seedBlankOnHand(page, spec.id, 1);
    const { design } = await seedPrintedOnHand(page, 5);

    await page.goto("/pt-BR/assembly");
    await page.getByRole("button", { name: /Montagem avulsa/ }).click();
    await expect(page.getByTestId("assemble-sheet")).toBeVisible();

    // Pick the freshly-seeded blank + printed by their unique codes. The selects
    // list every in-stock piece in the (shared) tenant, so `.first()` would be
    // non-deterministic — target this test's own spec/design instead.
    await page.getByTestId("assemble-blank-select").click();
    await page.getByRole("option", { name: new RegExp(spec.code) }).click();
    await page.getByTestId("assemble-printed-select").click();
    await page.getByRole("option", { name: new RegExp(design.code) }).click();

    // The sheet caps over-assembly client-side: it surfaces the on-hand ceiling
    // and never lets a run exceed it (finished stock can't be over-built).
    // Typing a quantity above the max (1) flags the input invalid and the submit
    // button still only commits the clamped amount.
    const qty = page.getByTestId("assemble-qty");
    await qty.fill("9");
    await expect(page.getByText("Até 1 disponíveis")).toBeVisible();
    await expect(qty).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByTestId("assemble-submit")).toHaveText(/Montar\s*1/);

    // Submitting the clamped run succeeds (no over-build, no inline error).
    await page.getByTestId("assemble-submit").click();
    await expect(page.getByTestId("assemble-sheet")).not.toBeVisible();
    await expect(page.getByTestId("assemble-error")).toHaveCount(0);
  });
});
