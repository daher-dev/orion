import { BYPASS_UID, test, expect, type APIRequestContext, type Page } from "./_support";

/**
 * E2E coverage for Phase 5 — Planejamento (the demand→production engine).
 *
 * Dev-bypass auth + a running backend. The planning demand source is the
 * EXISTING orders + order_items: we seed a full catalog chain (spec → design →
 * product[spec_id + print_id] → variation → ad → client), an order, then
 * materialize its per-piece order_items via the labels endpoint (open demand
 * with no finished stock + no WIP). The page must then suggest one Corte
 * (grouped by spec+color) and one Impressão (per design), both demand-driven.
 * Selecting all + "Criar N ordens" creates PENDING cutting + print orders,
 * cross-checked via the API.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HEADERS = {
  "X-Dev-Bypass-Uid": BYPASS_UID,
  "X-Dev-Bypass-Name": "QA Dev User",
  "X-Dev-Bypass-Email": "qa-dev@orion.local",
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

function rand(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

async function resetDb(request: APIRequestContext) {
  await request.post(`${API_URL}/v1/test-support/reset`, { headers: HEADERS });
}

type Seed = {
  specId: string;
  specCode: string;
  designId: string;
  designCode: string;
  variationId: string;
  orderId: string;
};

/** Seed open demand: a paid order whose items resolve to (design, spec, color, size). */
async function seedDemand(request: APIRequestContext, quantity = 6): Promise<Seed> {
  const specCode = rand("FT");
  const spec = await apiPost(request, "/v1/specs", {
    code: specCode,
    name: "Camiseta Box",
    fabric_type: "jersey",
    fabric_grammage_gsm: 180,
    fabric_weight_per_piece_g: "250.00",
    has_ribana: false,
    labor_cost: "12.00",
    sale_price: "99.00",
  });

  const designCode = rand("DSN");
  const design = await apiPost(request, "/v1/prints", {
    code: designCode,
    name: "Naruto",
    technique: "dtf",
    cost_per_unit: "5.00",
    has_front: true,
    has_back: false,
  });

  // Planning resolves a FRONT-ready PrintDesignVariation when materializing an
  // impressão suggestion into a print order; a design with no variation is
  // skipped (reason=no_variation). Seed one with a front artwork URL so the
  // create produces a real PENDING print order.
  await apiPost(request, `/v1/prints/${design.id}/variations`, {
    name: "Default",
    ink_hex: "#1f1f1f",
    front_file_url: "https://example.com/front.png",
  });

  // Product MUST carry a print_id — planning's demand join is INNER on the
  // resolved PrintDesign (no estampa = nothing to print/assemble against).
  const product = await apiPost(request, "/v1/products", {
    name: "Camiseta Naruto",
    // Backend ProductType enum is garment-named (camiseta / moletom / …).
    product_type: "camiseta",
    spec_id: spec.id,
    print_id: design.id,
    variations: [{ size: "m", color: "Preto", color_code: "PRT" }],
  });
  const variation = product.variations[0];

  const client = await apiPost(request, "/v1/clients", { name: "Mariana Costa", email: "m@example.com" });
  const ad = await apiPost(request, "/v1/ads", {
    title: "Camiseta Verão",
    ecommerce: "shopee",
    external_id: rand("AD"),
    product_ids: [product.id],
  });

  const order = await apiPost(request, "/v1/orders", {
    ad_id: ad.id,
    variation_id: variation.id,
    client_id: client.id,
    quantity,
    sale_price: "149.00",
    ordered_at: new Date().toISOString(),
  });

  // Materialize one OrderItem per unit (status label_printed != checked → open
  // demand). This is the per-piece demand the planning engine counts.
  await apiPost(request, `/v1/orders/${order.id}/labels`, {});

  return {
    specId: spec.id,
    specCode,
    designId: design.id,
    designCode,
    variationId: variation.id,
    orderId: order.id,
  };
}

async function gotoPlanning(page: Page) {
  await page.goto("/pt-BR/planning");
  await expect(page.getByRole("heading", { name: /Planejamento/i, level: 1 })).toBeVisible();
}

test.describe("Planejamento (Planning)", () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request);
  });

  test("suggests a corte + impressão from open order demand", async ({ page, request }) => {
    const seed = await seedDemand(request, 6);

    await gotoPlanning(page);

    // One Corte (spec+color) and one Impressão (design) suggestion.
    await expect(page.getByTestId(`planning-cut-row-${seed.specId}|PRT`)).toBeVisible();
    await expect(page.getByTestId(`planning-print-row-${seed.designId}`)).toBeVisible();
    // The impressão row shows the design code; demand badge is present.
    await expect(page.getByTestId(`planning-print-row-${seed.designId}`)).toContainText(seed.designCode);
    await expect(page.getByTestId("planning-source-badge").first()).toBeVisible();
  });

  test("creating the selected suggestions opens pending cutting + print orders", async ({ page, request }) => {
    const seed = await seedDemand(request, 6);

    await gotoPlanning(page);
    await expect(page.getByTestId(`planning-cut-row-${seed.specId}|PRT`)).toBeVisible();

    // All suggestions are selected by default — create them.
    await page.getByTestId("planning-create-button").click();

    // Success banner with the created codes.
    await expect(page.getByTestId("planning-created-banner")).toBeVisible();

    // Cross-check: a PENDING cutting order for the spec now exists.
    await expect
      .poll(async () => {
        const cutting = await apiGet(request, "/v1/cutting?page_size=100");
        return (cutting?.items ?? []).filter(
          (o: { spec: { id: string }; status: string }) => o.spec.id === seed.specId && o.status === "pending",
        ).length;
      })
      .toBeGreaterThan(0);

    // Cross-check: a PENDING print order for the design now exists.
    await expect
      .poll(async () => {
        const printing = await apiGet(request, "/v1/print-orders?page_size=100");
        return (printing?.items ?? []).filter(
          (o: { design: { id: string }; status: string }) => o.design.id === seed.designId && o.status === "pending",
        ).length;
      })
      .toBeGreaterThan(0);
  });

  test("the Estoque baixo filter hides demand-only suggestions", async ({ page, request }) => {
    const seed = await seedDemand(request, 6);

    await gotoPlanning(page);
    await expect(page.getByTestId(`planning-cut-row-${seed.specId}|PRT`)).toBeVisible();

    // No min-stock thresholds tripped (no catalog rows below minimum) → the
    // pure-demand suggestions drop out under the "Estoque baixo" filter.
    await page.getByTestId("planning-filter-estoque").click();
    await expect(page.getByTestId("planning-empty")).toBeVisible();
  });
});
