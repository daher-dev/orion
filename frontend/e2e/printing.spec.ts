import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for Phase 4 — Impressão (Print Orders · T4).
 *
 * Dev-bypass auth + a running backend (the reset script seeds the qa-dev-user
 * company as a manager). We seed a transfer-based estampa + variation (with a
 * front PNG so the side is print-ready) and a compatible DTF paper roll, create
 * a print order via the API, then drive the UI: record printed counts → "Lançar
 * impressos" → cross-check printed-transfers credited + paper meters debited.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function api(page: Page, method: string, path: string, body?: unknown) {
  return page.request.fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Bypass-Uid": "qa-dev-user",
      "X-Dev-Bypass-Name": "QA Dev User",
      "X-Dev-Bypass-Email": "qa-dev@orion.local",
    },
    data: body,
  });
}

function rand(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function seedDesignWithArtwork(page: Page) {
  const code = rand("DSN");
  const designRes = await api(page, "POST", "/v1/prints", {
    code,
    name: `Naruto ${code}`,
    technique: "dtf",
    cost_per_unit: "5.00",
    has_front: true,
    has_back: false,
  });
  expect(designRes.status()).toBe(201);
  const design = await designRes.json();

  // A variation WITH a front PNG → front_status resolves to "ok" so the
  // "mark printed" quick button is enabled.
  const varRes = await api(page, "POST", `/v1/prints/${design.id}/variations`, {
    name: "Clássica",
    ink_hex: "#1f1f1f",
    front_file_url: "https://example.com/art/front.png",
  });
  expect(varRes.status()).toBe(201);
  const variation = await varRes.json();

  return { design, variation };
}

async function seedPaperRoll(page: Page) {
  const res = await api(page, "POST", "/v1/paper-rolls", {
    received_at: "2026-06-01",
    supplier_name: rand("Sup "),
    paper_type: "dtf_film",
    width_cm: 60,
    initial_meters: "100.00",
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function seedPrintOrder(page: Page) {
  const { design, variation } = await seedDesignWithArtwork(page);
  const roll = await seedPaperRoll(page);
  const res = await api(page, "POST", "/v1/print-orders", {
    print_design_id: design.id,
    paper_roll_id: roll.id,
    planned_outputs: [{ print_design_variation_id: variation.id, side: "front", planned_quantity: 10 }],
  });
  expect(res.status()).toBe(201);
  const order = await res.json();
  return { design, variation, roll, order };
}

test.describe("Impressão (Print Orders)", () => {
  test("kanban lists a seeded order in the pending column", async ({ page }) => {
    const { order } = await seedPrintOrder(page);
    await page.goto("/pt-BR/printing");
    await expect(page.getByRole("heading", { name: /Impressão/, level: 1 })).toBeVisible();
    await expect(page.getByTestId("printing-kanban")).toBeVisible();
    await expect(page.getByTestId("printing-kanban-col-pending")).toContainText(order.code);
  });

  test("record printed → Lançar impressos credits printed-transfers + debits paper", async ({ page }) => {
    const { roll, order } = await seedPrintOrder(page);

    await page.goto("/pt-BR/printing");
    await page.getByText(order.code).first().click();
    await expect(page.getByTestId("print-order-detail-sheet")).toBeVisible();
    await expect(page.getByTestId("print-order-side-grid")).toBeVisible();

    // Use the PNG-gated quick button to set printed = planned (front PNG is ok).
    await page.getByTestId("print-order-side-grid-front").getByRole("button", { name: /printed/i }).first().click();

    // Post the printed transfers to stock.
    await page.getByTestId("print-order-launch").click();

    // Re-open: the launch posted, so the disabled "In stock" state shows.
    await expect(page.getByText(order.code).first()).toBeVisible();

    // Cross-check: printed transfers credited (+10 front for the design).
    const levels = await (await api(page, "GET", "/v1/printed-transfers/levels?page_size=200")).json();
    const credited = levels.items.find(
      (r: { print_design_id: string; side: string; on_hand: number }) =>
        r.print_design_id === order.design.id && r.side === "front",
    );
    expect(credited?.on_hand).toBe(10);

    // Cross-check: paper debited by rate*printed = 0.35 * 10 = 3.5 m → 96.5 left.
    const rollAfter = await (await api(page, "GET", `/v1/paper-rolls/${roll.id}`)).json();
    expect(Number(rollAfter.current_meters)).toBeCloseTo(96.5, 1);
  });

  test("table view renders the seeded order row", async ({ page }) => {
    const { order } = await seedPrintOrder(page);
    await page.goto("/pt-BR/printing");
    await page.getByRole("tab", { name: /Tabela/ }).click();
    await expect(page.getByText(order.code)).toBeVisible();
  });
});
