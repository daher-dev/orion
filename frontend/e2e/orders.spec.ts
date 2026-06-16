import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * E2E coverage for FEATURE-013 — Sales: Orders.
 *
 * Assumes the dev-bypass auth path is enabled and the backend is running.
 * `scripts/reset-test-db.sh` seeds a single company; the dev-bypass UID
 * `qa-dev-user` is provisioned as the manager.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HEADERS = {
  "X-Dev-Bypass-Uid": "qa-dev-user",
  "X-Dev-Bypass-Name": "QA Dev User",
  "X-Dev-Bypass-Email": "qa-dev@orion.local",
};

type SeedRefs = {
  specId: string;
  productId: string;
  variationId: string;
  clientId: string;
  adId: string;
};

async function apiPost(request: APIRequestContext, path: string, data: unknown) {
  const r = await request.post(`${API_URL}${path}`, {
    headers: { ...HEADERS, "Content-Type": "application/json" },
    data,
  });
  if (!r.ok()) {
    const body = await r.text();
    throw new Error(`POST ${path} failed: ${r.status()} ${body}`);
  }
  return r.json();
}

async function apiGet(request: APIRequestContext, path: string) {
  const r = await request.get(`${API_URL}${path}`, { headers: HEADERS });
  if (!r.ok()) return null;
  return r.json();
}

async function apiDelete(request: APIRequestContext, path: string) {
  await request.delete(`${API_URL}${path}`, { headers: HEADERS });
}

async function cleanup(request: APIRequestContext) {
  // Reach a clean slate via the non-prod test-support reset. This is required
  // (not just convenient): once an order ships the backend writes an
  // append-only StockExit and DELETE /v1/orders is permanently blocked, so an
  // API delete-loop cannot clear shipped/delivered orders. The reset truncates
  // tenant data tables while preserving the bootstrapped dev-bypass user.
  const reset = await request.post(`${API_URL}/v1/test-support/reset`, {
    headers: HEADERS,
  });
  if (reset.ok()) return;

  // Fallback for older backends without the reset endpoint: best-effort API
  // deletes (won't clear shipped orders, but keeps the suite usable).
  for (const endpoint of ["/v1/orders", "/v1/ads", "/v1/clients"]) {
    const data = await apiGet(request, `${endpoint}?page_size=100`);
    for (const item of (data?.items ?? []) as { id: string }[]) {
      await apiDelete(request, `${endpoint}/${item.id}`);
    }
  }
  const products = await apiGet(request, "/v1/products?page_size=100");
  for (const item of (products?.items ?? []) as { id: string }[]) {
    await apiDelete(request, `/v1/products/${item.id}`);
  }
  const specs = await apiGet(request, "/v1/specs?page_size=100");
  for (const item of (specs?.items ?? []) as { id: string }[]) {
    await apiDelete(request, `/v1/specs/${item.id}`);
  }
}

async function seedRefs(request: APIRequestContext): Promise<SeedRefs> {
  // 1. ProductSpec
  const spec = await apiPost(request, "/v1/specs", {
    code: `FT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    name: "Cropped Jersey",
    fabric_type: "jersey",
    fabric_grammage_gsm: 180,
    fabric_weight_per_piece_g: "250.00",
    has_ribana: false,
    labor_cost: "12.00",
    sale_price: "99.00",
  });

  // 2. Product + Variation
  const product = await apiPost(request, "/v1/products", {
    name: "Cropped Oversized",
    product_type: "cropped",
    spec_id: spec.id,
    variations: [{ size: "m", color: "Preto", color_code: "BLK" }],
  });
  const variation = product.variations[0];

  // 3. Client
  const client = await apiPost(request, "/v1/clients", {
    name: "Mariana Costa",
    email: "mariana@example.com",
  });

  // 4. Ad
  const ad = await apiPost(request, "/v1/ads", {
    title: "Cropped Verão 2026",
    ecommerce: "shopee",
    external_id: "SH-AD-99",
    product_ids: [product.id],
  });

  return {
    specId: spec.id,
    productId: product.id,
    variationId: variation.id,
    clientId: client.id,
    adId: ad.id,
  };
}

async function seedOrder(
  request: APIRequestContext,
  refs: SeedRefs,
  overrides: Record<string, unknown> = {},
) {
  return apiPost(request, "/v1/orders", {
    ad_id: refs.adId,
    variation_id: refs.variationId,
    client_id: refs.clientId,
    quantity: 1,
    sale_price: "149.00",
    ordered_at: new Date().toISOString(),
    ...overrides,
  });
}

async function gotoOrders(page: Page) {
  await page.goto("/pt-BR/orders");
  await expect(page.getByRole("heading", { name: /Pedidos/i, level: 1 })).toBeVisible();
}

/**
 * The orders page now defaults to the Quadro (board) view. The table-centric
 * assertions below (empty state, row testids, status filter) live behind the
 * "Tabela" toggle, so switch to it after the page lands.
 */
async function gotoOrdersTable(page: Page) {
  await gotoOrders(page);
  await page.getByTestId("orders-view-table").click();
}

/**
 * Credit finished stock for a variation so an order can clear the T6 ship
 * guard (shipping debits finished stock and 409s when on-hand can't cover the
 * order quantity). A manual `source=adjustment` entry is the canonical way to
 * seed counted finished inventory.
 */
async function creditFinishedStock(
  request: APIRequestContext,
  variationId: string,
  quantity: number,
) {
  await apiPost(request, "/v1/stock/entries", {
    variation_id: variationId,
    quantity,
    source: "adjustment",
    notes: "E2E finished-stock seed",
  });
}

test.describe("Sales: Orders", () => {
  test.beforeEach(async ({ request }) => {
    await cleanup(request);
  });

  test("empty state CTA is reachable when no orders exist", async ({ page }) => {
    await gotoOrdersTable(page);
    await expect(page.getByText("Nenhum pedido ainda")).toBeVisible();
  });

  test("renders a paginated list of orders with channel chips + status pills", async ({
    page,
    request,
  }) => {
    const refs = await seedRefs(request);
    await seedOrder(request, refs, { external_order_id: "E-1" });
    await seedOrder(request, refs, {
      external_order_id: "E-2",
      sale_price: "200.00",
    });

    await gotoOrdersTable(page);
    await expect(page.getByText("Mariana Costa").first()).toBeVisible();
    await expect(page.getByText("Cropped Oversized").first()).toBeVisible();

    // Channel chip rendered (Shopee, short code "SH")
    await expect(page.getByTestId(/channel-chip-shopee/).first()).toBeVisible();
    // Status pill (pending)
    await expect(page.getByTestId(/order-status-pending/).first()).toBeVisible();
  });

  test("status filter narrows the table", async ({ page, request }) => {
    const refs = await seedRefs(request);
    const pendingOrder = await seedOrder(request, refs, { external_order_id: "PEND" });
    const paidOrder = await seedOrder(request, refs, { external_order_id: "PAID" });
    await apiPost(request, `/v1/orders/${paidOrder.id}/status`, { status: "paid" });

    await gotoOrdersTable(page);
    // Both rows visible by default. Target rows by their stable row testid:
    // the localized status pill ("Pendente"/"Pago") substring-collides with the
    // external_order_id text ("PEND"/"PAID") under getByText's case-insensitive
    // match, so we key off the row id instead.
    const pendingRow = page.getByTestId(`order-row-${pendingOrder.id}`);
    const paidRow = page.getByTestId(`order-row-${paidOrder.id}`);
    await expect(pendingRow).toBeVisible();
    await expect(paidRow).toBeVisible();

    // Open Status filter, pick Paid
    await page.getByLabel("Status").first().click();
    await page.getByRole("option", { name: "Pago" }).click();
    await expect(paidRow).toBeVisible();
    await expect(pendingRow).not.toBeVisible();
  });

  test("clicking a row opens the detail and the timeline transitions through phases", async ({
    page,
    request,
  }) => {
    const refs = await seedRefs(request);
    const order = await seedOrder(request, refs, { external_order_id: "FLOW" });
    // Shipping debits finished stock (T6 guard) — credit enough first so the
    // ship transition isn't rejected with 409 "Insufficient finished stock".
    await creditFinishedStock(request, refs.variationId, 5);

    await page.goto(`/pt-BR/orders/${order.id}`);
    await expect(page.getByRole("heading", { name: /ORD-/, level: 1 })).toBeVisible();
    await expect(page.getByTestId("order-status-timeline")).toBeVisible();
    await expect(page.getByTestId("order-status-pending")).toBeVisible();

    // Mark paid via the transition rail
    await page.getByTestId("transition-paid").click();
    await expect(page.getByTestId("order-status-paid")).toBeVisible({ timeout: 5000 });

    // Mark shipped — triggers stock exit
    await page.getByTestId("transition-shipped").click();
    await expect(page.getByTestId("order-status-shipped")).toBeVisible({ timeout: 5000 });

    // Verify the backend created a stock exit for the order.
    const exits = await apiGet(request, `/v1/stock/exits?order_id=${order.id}`);
    // /v1/stock/exits may not exist — check audit instead.
    if (exits && Array.isArray(exits.items)) {
      expect(exits.items.length).toBeGreaterThan(0);
    } else {
      const audits = await apiGet(
        request,
        `/v1/audit-logs?resource_type=orders&page_size=20`,
      );
      const messages = (audits?.items ?? []).map((e: { message: string }) => e.message);
      expect(messages.some((m: string) => m.includes("SHIPPED"))).toBe(true);
    }

    // Mark delivered
    await page.getByTestId("transition-delivered").click();
    await expect(page.getByTestId("order-status-delivered")).toBeVisible({ timeout: 5000 });
  });

  test("delete is blocked when stock has moved", async ({ page, request }) => {
    const refs = await seedRefs(request);
    const order = await seedOrder(request, refs, { external_order_id: "BLOCKED" });
    // Credit finished stock so the ship transition clears the T6 guard, then
    // move pending → paid → shipped. Shipping writes an append-only StockExit,
    // which is what permanently blocks deletion.
    await creditFinishedStock(request, refs.variationId, 5);
    await apiPost(request, `/v1/orders/${order.id}/status`, { status: "paid" });
    await apiPost(request, `/v1/orders/${order.id}/status`, { status: "shipped" });

    await page.goto(`/pt-BR/orders/${order.id}`);
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    // Confirm in the alert dialog
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Excluir", exact: true })
      .click();
    // The toast should mention "estoque foi movimentado"
    await expect(page.getByText(/estoque foi movimentado/i)).toBeVisible();
    // Order still exists.
    await expect(page.getByRole("heading", { name: /ORD-/, level: 1 })).toBeVisible();
  });

  test("delete works on a pending order and returns to the list", async ({
    page,
    request,
  }) => {
    const refs = await seedRefs(request);
    const order = await seedOrder(request, refs, { external_order_id: "DELME" });

    await page.goto(`/pt-BR/orders/${order.id}`);
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Excluir", exact: true })
      .click();

    // The delete succeeds (204) but the success toast + redirect only fire
    // after React Query finishes invalidating the now-404 detail query, which
    // retries with backoff (~6-7s). Allow generous time for the success path.
    await expect(page.getByText("Pedido excluído")).toBeVisible({ timeout: 15000 });
    // Returned to /orders
    await expect(page).toHaveURL(/\/orders$/, { timeout: 15000 });
  });
});
